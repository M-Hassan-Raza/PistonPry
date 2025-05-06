(() => {
     // Prevent multiple injections running simultaneously
     if (window.isLinkExtractorDrawingActive) {
       console.log("Link Extractor: Drawing is already active.");
       return;
     }
     window.isLinkExtractorDrawingActive = true;
   
     let startX, startY, selectionDiv;
     let isDrawing = false;
     const originalCursor = document.body.style.cursor;
   
     function createSelectionDiv() {
       const div = document.createElement('div');
       div.style.position = 'fixed'; // Relative to viewport
       div.style.border = '2px dashed #007bff';
       div.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
       div.style.zIndex = '2147483647'; // Max z-index
       div.style.pointerEvents = 'none'; // So it doesn't interfere with mouse events on elements below
       document.body.appendChild(div);
       return div;
     }
   
     function onMouseDown(e) {
       // Only react to the main (left) mouse button
       if (e.button !== 0) return;
   
       e.preventDefault(); // Prevent default actions like text selection or drag-and-drop
       e.stopPropagation(); // Stop event from bubbling up
   
       isDrawing = true;
       startX = e.clientX;
       startY = e.clientY;
   
       if (selectionDiv) selectionDiv.remove(); // Remove any pre-existing div
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
       // Only react to the main (left) mouse button
       if (e.button !== 0 && selectionDiv) { // if it's not a left click but selectionDiv exists, it might be a context menu click during drag
           return; // Don't finalize selection on right click for example
       }
   
       isDrawing = false;
       e.preventDefault();
       e.stopPropagation();
   
       document.removeEventListener('mousemove', onMouseMove, true);
       document.removeEventListener('mouseup', onMouseUp, true);
       document.removeEventListener('mousedown', onMouseDown, true); // Remove this specific mousedown listener
       document.body.style.cursor = originalCursor; // Restore original cursor
   
       if (selectionDiv) {
         const rect = selectionDiv.getBoundingClientRect();
         selectionDiv.remove(); // Remove the visual selection box
         selectionDiv = null;
   
         // Only proceed if the rectangle has some area
         if (rect.width > 0 && rect.height > 0) {
           extractLinksInRegion(rect);
         } else {
           console.log("Selection area was too small.");
           if (chrome.runtime && chrome.runtime.sendMessage) {
               chrome.runtime.sendMessage({ action: "extractedLinks", links: [] });
           }
         }
       }
       window.isLinkExtractorDrawingActive = false; // Allow re-activation
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