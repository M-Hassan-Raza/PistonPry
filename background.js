// Listen for when the user clicks the extension's browser action icon
chrome.action.onClicked.addListener((tab) => {
     // Ensure the tab has a URL and it's an http/https page
     if (tab.url && (tab.url.startsWith("http://") || tab.url.startsWith("https://"))) {
          // Execute the content script in the current tab
          chrome.scripting.executeScript({
               target: { tabId: tab.id },
               files: ['content.js']
          }).catch(err => console.error("Failed to inject content script: ", err));
     } else {
          console.log("Link Extractor: Cannot inject script into this page (e.g., chrome:// pages, file URLs without permission, or empty tabs).");
          // Optionally, you could try to alert the user or log this more visibly.
          // For instance, by trying to execute a simple alert script:
          chrome.scripting.executeScript({
               target: { tabId: tab.id },
               func: () => {
                    alert("This extension cannot run on the current page (e.g., system pages like chrome:// or the web store). Please try on a regular website.");
               }
          }).catch(err => console.error("Failed to show page restriction alert: ", err));
     }
});

// Listener for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
     if (request.action === "extractedLinks") {
          if (request.links && request.links.length > 0) {
               const linksHtml = request.links
                    .map(link => `<li><a href="${link}" target="_blank" rel="noopener noreferrer">${link}</a></li>`)
                    .join('');
               const newTabContent = `
           <html>
             <head>
               <title>Extracted Links</title>
               <style>
                 body { font-family: sans-serif; padding: 20px; }
                 ul { list-style-type: none; padding-left: 0; }
                 li { margin-bottom: 8px; }
                 a { word-break: break-all; }
               </style>
             </head>
             <body>
               <h1>Extracted Links</h1>
               <ul>${linksHtml}</ul>
             </body>
           </html>`;
               chrome.tabs.create({ url: 'data:text/html;charset=UTF-8,' + encodeURIComponent(newTabContent) });
          } else {
               // Inform the user that no links were found, by injecting a small script to show an alert on the active tab.
               if (sender.tab && sender.tab.id) {
                    chrome.scripting.executeScript({
                         target: { tabId: sender.tab.id },
                         func: () => { alert("No links found in the selected region."); }
                    }).catch(err => console.error("Failed to show 'no links found' alert: ", err));
               } else {
                    console.log("No links found, and no sender tab ID to show an alert.");
               }
          }
          sendResponse({ status: "Links processed" });
     }
     return true; // Required for asynchronous sendResponse, though not strictly needed here as it's sync.
});