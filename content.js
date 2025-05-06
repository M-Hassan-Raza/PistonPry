(() => {
     // Prevent multiple injections running simultaneously
     if (window.isLinkExtractorDrawingActive) {
          console.log("Link Extractor: Drawing is already active.");
          return;
     }
     window.isLinkExtractorDrawingActive = true;

     let startX, startY, selectionDiv, overlayDiv;
     let isDrawing = false;
     const originalCursor = document.body.style.cursor;

     function createOverlay() {
          const div = document.createElement('div');
          div.style.position = 'fixed';
          div.style.top = '0';
          div.style.left = '0';
          div.style.width = '100%';
          div.style.height = '100%';
          div.style.backgroundColor = 'rgba(0, 0, 0, 0.4)'; // Darker grey overlay
          div.style.zIndex = '2147483646'; // Just below the selection div
          div.style.pointerEvents = 'none';
          document.body.appendChild(div);
          return div;
     }

     function createSelectionDiv() {
          const div = document.createElement('div');
          div.style.position = 'fixed';
          div.style.border = '2px dashed #007bff';
          div.style.backgroundColor = 'transparent'; // Make selection area transparent
          div.style.zIndex = '2147483647';
          div.style.pointerEvents = 'none';
          div.style.mixBlendMode = 'normal'; // Ensures the selection area stays white
          document.body.appendChild(div);
          return div;
     }

     function onMouseDown(e) {
          if (e.button !== 0) return;

          e.preventDefault();
          e.stopPropagation();

          isDrawing = true;
          startX = e.clientX;
          startY = e.clientY;

          // Create overlay first
          overlayDiv = createOverlay();

          if (selectionDiv) selectionDiv.remove();
          selectionDiv = createSelectionDiv();
          selectionDiv.style.left = `${startX}px`;
          selectionDiv.style.top = `${startY}px`;
          selectionDiv.style.width = '0px';
          selectionDiv.style.height = '0px';

          document.addEventListener('mousemove', onMouseMove, true);
          document.addEventListener('mouseup', onMouseUp, true);
     }

     function onMouseMove(e) {
          if (!isDrawing) return;
          e.preventDefault();
          e.stopPropagation();

          const currentX = e.clientX;
          const currentY = e.clientY;

          const newLeft = Math.min(currentX, startX);
          const newTop = Math.min(currentY, startY);
          const width = Math.abs(currentX - startX);
          const height = Math.abs(currentY - startY);

          selectionDiv.style.left = `${newLeft}px`;
          selectionDiv.style.top = `${newTop}px`;
          selectionDiv.style.width = `${width}px`;
          selectionDiv.style.height = `${height}px`;
     }

     function onMouseUp(e) {
          if (!isDrawing) return;
          if (e.button !== 0 && selectionDiv) {
               return;
          }

          isDrawing = false;
          e.preventDefault();
          e.stopPropagation();

          document.removeEventListener('mousemove', onMouseMove, true);
          document.removeEventListener('mouseup', onMouseUp, true);
          document.removeEventListener('mousedown', onMouseDown, true);
          document.body.style.cursor = originalCursor;

          // Remove both overlay and selection div
          if (overlayDiv) {
               overlayDiv.remove();
               overlayDiv = null;
          }

          if (selectionDiv) {
               const rect = selectionDiv.getBoundingClientRect();
               selectionDiv.remove();
               selectionDiv = null;

               if (rect.width > 0 && rect.height > 0) {
                    extractLinksInRegion(rect);
               } else {
                    console.log("Selection area was too small.");
                    if (chrome.runtime && chrome.runtime.sendMessage) {
                         chrome.runtime.sendMessage({ action: "extractedLinks", links: [] });
                    }
               }
          }
          window.isLinkExtractorDrawingActive = false;
     }

     function extractLinksInRegion(selectionRect) {
          const allLinks = document.querySelectorAll('a[href]');
          const extractedLinks = new Set(); // Use a Set to automatically handle duplicates

          allLinks.forEach(link => {
               const linkRect = link.getBoundingClientRect();

               // Check for visibility and non-zero size
               const style = window.getComputedStyle(link);
               const isVisible = style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    linkRect.width > 0 &&
                    linkRect.height > 0;

               if (!isVisible) return;

               // Check if the link's rectangle overlaps with the selection rectangle
               const overlaps = !(
                    selectionRect.right < linkRect.left ||
                    selectionRect.left > linkRect.right ||
                    selectionRect.bottom < linkRect.top ||
                    selectionRect.top > linkRect.bottom
               );

               if (overlaps && link.href) {
                    extractedLinks.add(link.href);
               }
          });

          if (chrome.runtime && chrome.runtime.sendMessage) {
               chrome.runtime.sendMessage({ action: "extractedLinks", links: Array.from(extractedLinks) });
          } else {
               console.error("Cannot send message to background script.");
               alert("Extracted Links:\n" + Array.from(extractedLinks).join("\n"));
          }
     }

     // Start listening for the first mousedown to initiate drawing
     document.body.style.cursor = 'crosshair';
     document.addEventListener('mousedown', onMouseDown, { capture: true, once: true });
     // `once: true` means this listener will be removed after the first mousedown.
     // `capture: true` helps catch the event before other elements on the page.

     // Optional: Add an escape key listener to cancel drawing
     function cancelDrawing(e) {
          if (e.key === "Escape") {
               if (isDrawing || window.isLinkExtractorDrawingActive) { // Check if drawing has started or is armed
                    isDrawing = false;
                    if (selectionDiv) selectionDiv.remove();
                    if (overlayDiv) overlayDiv.remove();
                    document.removeEventListener('mousemove', onMouseMove, true);
                    document.removeEventListener('mouseup', onMouseUp, true);
                    document.removeEventListener('mousedown', onMouseDown, true); // Also remove the initial mousedown listener if it wasn't triggered
                    document.removeEventListener('keydown', cancelDrawing, true); // Remove self
                    document.body.style.cursor = originalCursor;
                    window.isLinkExtractorDrawingActive = false;
                    console.log("Link extraction cancelled by Escape key.");
               }
          }
     }
     document.addEventListener('keydown', cancelDrawing, { capture: true });

})();