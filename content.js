(() => {
     // Prevent multiple injections running simultaneously
     if (window.isLinkExtractorDrawingActive) {
          console.log("Link Extractor: Drawing is already active.");
          return;
     }
     window.isLinkExtractorDrawingActive = true;

     let startX, startY, selectionDiv, overlayDiv, countIndicator;
     let isDrawing = false;
     const originalCursor = document.body.style.cursor;
     let highlightedLinks = new Set(); // Track currently highlighted links

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

     function createCountIndicator() {
          const div = document.createElement('div');
          div.style.position = 'fixed';
          div.style.backgroundColor = '#007bff';
          div.style.color = 'white';
          div.style.padding = '4px 8px';
          div.style.borderRadius = '12px';
          div.style.fontSize = '12px';
          div.style.fontWeight = 'bold';
          div.style.zIndex = '2147483647';
          div.style.pointerEvents = 'none';
          div.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
          div.style.transition = 'transform 0.1s ease-out';
          div.textContent = '0 links';
          div.style.display = 'none'; // Initially hidden
          document.body.appendChild(div);
          return div;
     }

     function highlightLink(link) {
          if (!highlightedLinks.has(link)) {
               link.style.transition = 'all 0.1s ease-in-out';
               link.style.backgroundColor = 'rgba(0, 123, 255, 0.3)';
               link.style.borderRadius = '2px';
               link.style.outline = '2px solid #007bff';
               highlightedLinks.add(link);
          }
     }

     function unhighlightLink(link) {
          if (highlightedLinks.has(link)) {
               link.style.backgroundColor = '';
               link.style.outline = '';
               link.style.transition = '';
               highlightedLinks.delete(link);
          }
     }

     function updateLinkHighlights(selectionRect) {
          const allLinks = document.querySelectorAll('a[href]');
          const currentlySelected = new Set();

          allLinks.forEach(link => {
               const linkRect = link.getBoundingClientRect();
               const style = window.getComputedStyle(link);
               const isVisible = style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    linkRect.width > 0 &&
                    linkRect.height > 0;

               if (!isVisible) return;

               const overlaps = !(
                    selectionRect.right < linkRect.left ||
                    selectionRect.left > linkRect.right ||
                    selectionRect.bottom < linkRect.top ||
                    selectionRect.top > linkRect.bottom
               );

               if (overlaps) {
                    currentlySelected.add(link);
                    highlightLink(link);
               } else if (highlightedLinks.has(link)) {
                    unhighlightLink(link);
               }
          });

          // Remove highlights from links that are no longer selected
          highlightedLinks.forEach(link => {
               if (!currentlySelected.has(link)) {
                    unhighlightLink(link);
               }
          });

          // Update count indicator
          updateCountIndicator(currentlySelected.size);
     }

     function updateCountIndicator(count) {
          if (!countIndicator) return;

          countIndicator.style.display = count > 0 ? 'block' : 'none';
          countIndicator.textContent = count + (count === 1 ? ' link' : ' links');

          // Scale animation effect when count changes
          countIndicator.style.transform = 'scale(1.1)';
          setTimeout(() => {
               if (countIndicator) countIndicator.style.transform = 'scale(1)';
          }, 100);
     }

     function positionCountIndicator(x, y) {
          if (!countIndicator) return;

          // Position above and to the right of the cursor
          countIndicator.style.left = `${x + 10}px`;
          countIndicator.style.top = `${y - 30}px`;
     }

     function clearAllHighlights() {
          highlightedLinks.forEach(link => unhighlightLink(link));
          highlightedLinks.clear();
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

          // Create count indicator
          if (countIndicator) countIndicator.remove();
          countIndicator = createCountIndicator();
          positionCountIndicator(startX, startY);

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

          // Position count indicator at the cursor position
          positionCountIndicator(e.clientX, e.clientY);

          // Update link highlights based on current selection rectangle
          updateLinkHighlights({
               left: newLeft,
               top: newTop,
               right: newLeft + width,
               bottom: newTop + height
          });
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

          // Remove highlights before removing divs
          clearAllHighlights();

          if (overlayDiv) {
               overlayDiv.remove();
               overlayDiv = null;
          }

          if (countIndicator) {
               countIndicator.remove();
               countIndicator = null;
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
                    clearAllHighlights();
                    if (selectionDiv) selectionDiv.remove();
                    if (overlayDiv) overlayDiv.remove();
                    if (countIndicator) countIndicator.remove();
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