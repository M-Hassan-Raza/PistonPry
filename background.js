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
                 body { 
                    font-family: system-ui, -apple-system, sans-serif; 
                    padding: 20px; 
                    max-width: 1200px; 
                    margin: 0 auto; 
                    background: #f5f5f5;
                 }
                 .container {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                 }
                 .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                 }
                 .controls {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                 }
                 button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    background: #007bff;
                    color: white;
                    cursor: pointer;
                 }
                 button:hover {
                    background: #0056b3;
                 }
                 input {
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    width: 200px;
                 }
                 ul { 
                    list-style-type: none; 
                    padding-left: 0; 
                    margin-top: 20px;
                 }
                 li { 
                    margin-bottom: 8px;
                    padding: 8px;
                    border: 1px solid #eee;
                    border-radius: 4px;
                 }
                 li:hover {
                    background: #f8f9fa;
                 }
                 a { 
                    word-break: break-all;
                    color: #0066cc;
                    text-decoration: none;
                 }
                 a:hover {
                    text-decoration: underline;
                 }
                 .stats {
                    color: #666;
                    font-size: 14px;
                 }
               </style>
             </head>
             <body>
               <div class="container">
                 <div class="header">
                   <h1>Extracted Links</h1>
                   <span class="stats">Total Links: <span id="linkCount">${request.links.length}</span></span>
                 </div>
                 <div class="controls">
                   <input type="text" id="filterInput" placeholder="Filter by domain or text...">
                   <button onclick="copyAllLinks()">Copy All Links</button>
                   <button onclick="filterValidLinks()">Show Valid Links</button>
                 </div>
                 <ul id="linksList">${linksHtml}</ul>
               </div>

               <script>
                 // Copy all links to clipboard
                 function copyAllLinks() {
                   const links = Array.from(document.querySelectorAll('a')).map(a => a.href).join('\\n');
                   navigator.clipboard.writeText(links).then(() => {
                     alert('All links copied to clipboard!');
                   }).catch(err => {
                     console.error('Failed to copy links: ', err);
                   });
                 }

                 // Filter links based on input
                 document.getElementById('filterInput').addEventListener('input', (e) => {
                   const filter = e.target.value.toLowerCase();
                   const items = document.querySelectorAll('li');
                   let count = 0;
                   
                   items.forEach(item => {
                     const link = item.textContent.toLowerCase();
                     if (link.includes(filter)) {
                       item.style.display = '';
                       count++;
                     } else {
                       item.style.display = 'none';
                     }
                   });
                   
                   document.getElementById('linkCount').textContent = count;
                 });

                 // Filter valid links (basic check)
                 function filterValidLinks() {
                   const items = document.querySelectorAll('li a');
                   let count = 0;
                   
                   items.forEach(async (link) => {
                     const li = link.parentElement;
                     try {
                       const url = new URL(link.href);
                       if (url.protocol === 'http:' || url.protocol === 'https:') {
                         li.style.display = '';
                         count++;
                       } else {
                         li.style.display = 'none';
                       }
                     } catch (e) {
                       li.style.display = 'none';
                     }
                   });
                   
                   document.getElementById('linkCount').textContent = count;
                 }
               </script>
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