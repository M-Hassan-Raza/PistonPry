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

// Helper function to save a collection to storage
function saveLinkCollection(name, links, sourceUrl) {
     return new Promise((resolve, reject) => {
          chrome.storage.local.get(['linkCollections'], (result) => {
               const collections = result.linkCollections || [];
               const timestamp = new Date().toISOString();

               // Create a new collection
               const newCollection = {
                    id: Date.now().toString(),
                    name,
                    links,
                    sourceUrl,
                    timestamp,
                    count: links.length
               };

               collections.push(newCollection);

               chrome.storage.local.set({ linkCollections: collections }, () => {
                    if (chrome.runtime.lastError) {
                         reject(chrome.runtime.lastError);
                    } else {
                         resolve(newCollection);
                    }
               });
          });
     });
}

// Helper function to get all saved collections
function getAllCollections() {
     return new Promise((resolve) => {
          chrome.storage.local.get(['linkCollections'], (result) => {
               resolve(result.linkCollections || []);
          });
     });
}

// Helper function to delete a collection
function deleteCollection(collectionId) {
     return new Promise((resolve, reject) => {
          chrome.storage.local.get(['linkCollections'], (result) => {
               const collections = result.linkCollections || [];
               const updatedCollections = collections.filter(c => c.id !== collectionId);

               chrome.storage.local.set({ linkCollections: updatedCollections }, () => {
                    if (chrome.runtime.lastError) {
                         reject(chrome.runtime.lastError);
                    } else {
                         resolve();
                    }
               });
          });
     });
}

// Helper function to save extraction history
function saveExtractionHistory(links, sourceUrl, sourceTitle) {
     return new Promise((resolve, reject) => {
          chrome.storage.local.get(['extractionHistory'], (result) => {
               const history = result.extractionHistory || [];
               const timestamp = new Date().toISOString();

               // Create a new history entry
               const newEntry = {
                    id: Date.now().toString(),
                    timestamp,
                    sourceUrl,
                    sourceTitle: sourceTitle || (new URL(sourceUrl)).hostname,
                    count: links.length,
                    links: links.slice(0, 3) // Just store the first 3 links as a preview
               };

               // Keep only the last 10 entries (most recent first)
               history.unshift(newEntry);
               if (history.length > 10) {
                    history.length = 10;
               }

               chrome.storage.local.set({ extractionHistory: history }, () => {
                    if (chrome.runtime.lastError) {
                         reject(chrome.runtime.lastError);
                    } else {
                         resolve(history);
                    }
               });
          });
     });
}

// Helper function to get extraction history
function getExtractionHistory() {
     return new Promise((resolve) => {
          chrome.storage.local.get(['extractionHistory'], (result) => {
               resolve(result.extractionHistory || []);
          });
     });
}

// Listener for messages from the content script or result page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
     if (request.action === "extractedLinks") {
          if (request.links && request.links.length > 0) {
               // Process links to identify their types
               const processedLinks = request.links.map(link => {
                    // Extract domain information
                    let domain = '';
                    let isExternal = false;
                    try {
                         const url = new URL(link);
                         domain = url.hostname;
                         // Check if it's an external link (different from the current page)
                         if (sender.tab && sender.tab.url) {
                              const tabUrl = new URL(sender.tab.url);
                              isExternal = url.hostname !== tabUrl.hostname;
                         }
                    } catch (e) {
                         console.error("Invalid URL:", link);
                    }

                    // Determine link type based on extension or patterns
                    let type = 'webpage';
                    const lowerCaseLink = link.toLowerCase();
                    if (lowerCaseLink.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)(\?.*)?$/)) {
                         type = 'image';
                    } else if (lowerCaseLink.match(/\.(pdf)(\?.*)?$/)) {
                         type = 'pdf';
                    } else if (lowerCaseLink.match(/\.(doc|docx|xls|xlsx|ppt|pptx)(\?.*)?$/)) {
                         type = 'document';
                    } else if (lowerCaseLink.match(/\.(mp4|webm|ogg|mov|avi)(\?.*)?$/)) {
                         type = 'video';
                    } else if (lowerCaseLink.match(/\.(mp3|wav|flac|ogg)(\?.*)?$/)) {
                         type = 'audio';
                    } else if (lowerCaseLink.includes('youtube.com/watch') || lowerCaseLink.includes('youtu.be/')) {
                         type = 'youtube';
                    } else if (lowerCaseLink.match(/\.(zip|rar|7z|tar|gz)(\?.*)?$/)) {
                         type = 'archive';
                    }

                    return {
                         url: link,
                         domain,
                         isExternal,
                         type
                    };
               });

               // Source URL for the collection
               const sourceUrl = sender.tab ? sender.tab.url : '';
               const sourceTitle = sender.tab ? sender.tab.title : '';

               // Save to extraction history
               saveExtractionHistory(request.links, sourceUrl, sourceTitle);

               // Generate HTML for links with checkboxes for bulk actions
               const linksHtml = processedLinks
                    .map(link => `
                    <li data-type="${link.type}" data-domain="${link.domain}" data-external="${link.isExternal}">
                         <input type="checkbox" class="link-checkbox">
                         <a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.url}</a>
                         <span class="link-meta">[${link.type}${link.isExternal ? ', external' : ''}]</span>
                    </li>`)
                    .join('');

               // Get unique link types for filter dropdown
               const linkTypes = [...new Set(processedLinks.map(link => link.type))];
               const typeOptionsHtml = linkTypes
                    .map(type => `<option value="${type}">${type.charAt(0).toUpperCase() + type.slice(1)}</option>`)
                    .join('');

               // Initialize collections section
               getAllCollections().then(collections => {
                    const collectionsHtml = collections.map(collection => `
                        <div class="collection-item" data-id="${collection.id}">
                            <div class="collection-header">
                                <h3>${collection.name}</h3>
                                <div>
                                    <span class="collection-count">${collection.count} links</span>
                                    <button class="view-collection" data-id="${collection.id}">View</button>
                                    <button class="delete-collection" data-id="${collection.id}">Delete</button>
                                </div>
                            </div>
                            <div class="collection-meta">
                                Saved on ${new Date(collection.timestamp).toLocaleDateString()} from
                                <a href="${collection.sourceUrl}" target="_blank">${new URL(collection.sourceUrl).hostname}</a>
                            </div>
                        </div>
                    `).join('') || '<p>No saved collections yet.</p>';

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
                    margin-bottom: 20px;
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
                    flex-wrap: wrap;
                 }
                 button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    background: #007bff;
                    color: white;
                    cursor: pointer;
                    transition: background-color 0.2s;
                 }
                 button:hover {
                    background: #0056b3;
                 }
                 button.delete-collection {
                    background: #dc3545;
                 }
                 button.delete-collection:hover {
                    background: #c82333;
                 }
                 input, select {
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
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
                    display: flex;
                    align-items: center;
                 }
                 li:hover {
                    background: #f8f9fa;
                 }
                 li input.link-checkbox {
                    margin-right: 10px;
                 }
                 a { 
                    word-break: break-all;
                    color: #0066cc;
                    text-decoration: none;
                    flex: 1;
                 }
                 a:hover {
                    text-decoration: underline;
                 }
                 .stats {
                    color: #666;
                    font-size: 14px;
                 }
                 .link-meta {
                    color: #666;
                    font-size: 12px;
                    margin-left: 8px;
                    white-space: nowrap;
                 }
                 .filter-group {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                 }
                 .filter-group label {
                    white-space: nowrap;
                 }
                 .tabs {
                    display: flex;
                    margin-bottom: 20px;
                    border-bottom: 1px solid #ddd;
                 }
                 .tab {
                    padding: 10px 20px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    transition: all 0.2s;
                 }
                 .tab.active {
                    border-bottom: 2px solid #007bff;
                    font-weight: bold;
                 }
                 .tab-content {
                    display: none;
                 }
                 .tab-content.active {
                    display: block;
                 }
                 #saveCollectionForm {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                 }
                 #saveCollectionForm input {
                    flex: 1;
                 }
                 .collection-item {
                    border: 1px solid #eee;
                    border-radius: 4px;
                    padding: 15px;
                    margin-bottom: 10px;
                 }
                 .collection-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                 }
                 .collection-header h3 {
                    margin: 0;
                 }
                 .collection-meta {
                    color: #666;
                    font-size: 14px;
                    margin-top: 5px;
                 }
                 .collection-count {
                    color: #666;
                    margin-right: 10px;
                 }
                 #exportOptions {
                    margin-top: 20px;
                    padding: 15px;
                    background-color: #f8f9fa;
                    border-radius: 4px;
                 }
                 #exportFormat {
                    margin: 0 10px;
                 }
                 .bulk-actions {
                    margin-top: 15px;
                    padding: 15px;
                    background-color: #f0f8ff;
                    border-radius: 4px;
                    border: 1px solid #e0f0ff;
                 }
                 .bulk-action-header {
                    margin-top: 0;
                    margin-bottom: 10px;
                    font-size: 16px;
                    color: #0056b3;
                 }
                 .bulk-actions-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 10px;
                 }
                 .select-options {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                 }
                 .select-option {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                 }
                 .loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(255, 255, 255, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                    visibility: hidden;
                    opacity: 0;
                    transition: opacity 0.3s, visibility 0.3s;
                 }
                 .loading-overlay.visible {
                    visibility: visible;
                    opacity: 1;
                 }
                 .loading-spinner {
                    width: 50px;
                    height: 50px;
                    border: 5px solid #f3f3f3;
                    border-top: 5px solid #007bff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                 }
                 @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                 }
               </style>
             </head>
             <body>
               <div class="tabs">
                 <div class="tab active" data-tab="current">Current Links</div>
                 <div class="tab" data-tab="saved">Saved Collections</div>
               </div>
               
               <div id="currentTab" class="tab-content active">
                 <div class="container">
                   <div class="header">
                     <h1>Extracted Links</h1>
                     <span class="stats">Total Links: <span id="linkCount">${processedLinks.length}</span></span>
                   </div>
                   <div class="controls">
                     <div class="filter-group">
                       <label for="filterInput">Search:</label>
                       <input type="text" id="filterInput" placeholder="Filter by text...">
                     </div>
                     <div class="filter-group">
                       <label for="typeFilter">Type:</label>
                       <select id="typeFilter">
                         <option value="">All Types</option>
                         ${typeOptionsHtml}
                       </select>
                     </div>
                     <div class="filter-group">
                       <label for="locationFilter">Location:</label>
                       <select id="locationFilter">
                         <option value="">All Links</option>
                         <option value="internal">Internal</option>
                         <option value="external">External</option>
                       </select>
                     </div>
                     <button onclick="copyAllLinks()">Copy All Links</button>
                     <button onclick="copyVisibleLinks()">Copy Visible Links</button>
                     <button onclick="resetFilters()">Reset Filters</button>
                   </div>
                   
                   <div id="exportOptions">
                     <label for="exportFormat">Export Format:</label>
                     <select id="exportFormat">
                       <option value="text">Plain Text</option>
                       <option value="csv">CSV</option>
                       <option value="json">JSON</option>
                       <option value="markdown">Markdown</option>
                       <option value="html">HTML</option>
                     </select>
                     <button onclick="exportLinks()">Export</button>
                   </div>
                   
                   <div class="bulk-actions">
                     <h3 class="bulk-action-header">Bulk Actions</h3>
                     
                     <div class="select-options">
                       <div class="select-option">
                         <input type="checkbox" id="selectAllLinks" onchange="toggleSelectAll()">
                         <label for="selectAllLinks">Select All</label>
                       </div>
                       <div class="select-option">
                         <button onclick="selectByType()">Select By Type</button>
                       </div>
                       <div class="select-option">
                         <button onclick="invertSelection()">Invert Selection</button>
                       </div>
                     </div>
                     
                     <div class="bulk-actions-row">
                       <button onclick="openSelectedLinks()">Open Selected Links</button>
                       <button onclick="copySelectedLinks()">Copy Selected Links</button>
                       <button onclick="downloadSelectedFiles()">Download Selected Files</button>
                       <button onclick="addSelectedToBookmarks()">Add Selected to Bookmarks</button>
                     </div>
                   </div>
                   
                   <ul id="linksList">${linksHtml}</ul>
                   
                   <form id="saveCollectionForm">
                     <input type="text" id="collectionName" placeholder="Collection Name..." required>
                     <button type="submit">Save Collection</button>
                   </form>
                 </div>
               </div>
               
               <div id="savedTab" class="tab-content">
                 <div class="container">
                   <div class="header">
                     <h1>Saved Collections</h1>
                   </div>
                   <div id="collectionsContainer">
                     ${collectionsHtml}
                   </div>
                 </div>
               </div>
               
               <div class="loading-overlay" id="loadingOverlay">
                 <div class="loading-spinner"></div>
               </div>

               <script>
                 // Toggle loading overlay
                 function showLoading() {
                   document.getElementById('loadingOverlay').classList.add('visible');
                 }
                 
                 function hideLoading() {
                   document.getElementById('loadingOverlay').classList.remove('visible');
                 }
               
                 // Copy all links to clipboard
                 function copyAllLinks() {
                   const links = Array.from(document.querySelectorAll('li a')).map(a => a.href).join('\\n');
                   navigator.clipboard.writeText(links).then(() => {
                     alert('All links copied to clipboard!');
                   }).catch(err => {
                     console.error('Failed to copy links: ', err);
                   });
                 }
                 
                 // Copy only visible links
                 function copyVisibleLinks() {
                   const visibleLinks = Array.from(document.querySelectorAll('li:not([style*="display: none"]) a')).map(a => a.href).join('\\n');
                   navigator.clipboard.writeText(visibleLinks).then(() => {
                     alert('Visible links copied to clipboard!');
                   }).catch(err => {
                     console.error('Failed to copy links: ', err);
                   });
                 }
                 
                 // Open selected links in new tabs
                 function openSelectedLinks() {
                   const selectedLinks = Array.from(document.querySelectorAll('li:not([style*="display: none"]) input.link-checkbox:checked'))
                     .map(cb => cb.closest('li').querySelector('a').href);
                     
                   if (selectedLinks.length === 0) {
                     alert('No links selected. Please select links using the checkboxes.');
                     return;
                   }
                   
                   if (selectedLinks.length > 10) {
                     if (!confirm(\`You are about to open \${selectedLinks.length} tabs. Continue?\`)) {
                       return;
                     }
                   }
                   
                   selectedLinks.forEach(url => window.open(url, '_blank'));
                 }
                 
                 // Copy selected links to clipboard
                 function copySelectedLinks() {
                   const selectedLinks = Array.from(document.querySelectorAll('li:not([style*="display: none"]) input.link-checkbox:checked'))
                     .map(cb => cb.closest('li').querySelector('a').href);
                     
                   if (selectedLinks.length === 0) {
                     alert('No links selected. Please select links using the checkboxes.');
                     return;
                   }
                   
                   navigator.clipboard.writeText(selectedLinks.join('\\n')).then(() => {
                     alert(\`\${selectedLinks.length} links copied to clipboard!\`);
                   }).catch(err => {
                     console.error('Failed to copy links: ', err);
                   });
                 }
                 
                 // Download selected files
                 function downloadSelectedFiles() {
                   const selectedItems = Array.from(document.querySelectorAll('li:not([style*="display: none"]) input.link-checkbox:checked'))
                     .map(cb => {
                       const li = cb.closest('li');
                       return {
                         url: li.querySelector('a').href,
                         type: li.getAttribute('data-type')
                       };
                     });
                     
                   if (selectedItems.length === 0) {
                     alert('No links selected. Please select links using the checkboxes.');
                     return;
                   }
                   
                   // Filter for only downloadable content
                   const downloadableTypes = ['image', 'pdf', 'document', 'video', 'audio', 'archive'];
                   const downloadable = selectedItems.filter(item => downloadableTypes.includes(item.type));
                   
                   if (downloadable.length === 0) {
                     alert('None of the selected links appear to be directly downloadable files. Try selecting links to images, documents, PDFs, etc.');
                     return;
                   }
                   
                   if (downloadable.length > 5) {
                     if (!confirm(\`You are about to download \${downloadable.length} files. Continue?\`)) {
                       return;
                     }
                   }
                   
                   // Show loading overlay for large downloads
                   if (downloadable.length > 2) {
                     showLoading();
                   }
                   
                   // Start downloads
                   let downloaded = 0;
                   downloadable.forEach(item => {
                     const a = document.createElement('a');
                     a.href = item.url;
                     a.download = ''; // Let browser determine filename from URL
                     document.body.appendChild(a);
                     a.click();
                     document.body.removeChild(a);
                     
                     downloaded++;
                     if (downloaded === downloadable.length && downloadable.length > 2) {
                       setTimeout(() => {
                         hideLoading();
                       }, 1000);
                     }
                   });
                 }
                 
                 // Add selected links to bookmarks
                 function addSelectedToBookmarks() {
                   const selectedLinks = Array.from(document.querySelectorAll('li:not([style*="display: none"]) input.link-checkbox:checked'))
                     .map(cb => {
                       const a = cb.closest('li').querySelector('a');
                       return { url: a.href, title: a.textContent.trim() };
                     });
                     
                   if (selectedLinks.length === 0) {
                     alert('No links selected. Please select links using the checkboxes.');
                     return;
                   }
                   
                   // Create a temporary folder name based on current date
                   const folderName = 'PistonPry Links - ' + new Date().toLocaleDateString();
                   
                   // In Chrome extensions, you can't programmatically add bookmarks without the bookmarks permission
                   // So we'll create a temp page with link tags and bookmark data attributes
                   const bookmarkPageContent = \`
                     <html>
                       <head>
                         <title>\${folderName}</title>
                         <style>
                           body { font-family: system-ui; padding: 30px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                           h1 { margin-bottom: 20px; }
                           .instructions { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                           ul { padding-left: 20px; }
                           li { margin-bottom: 10px; }
                         </style>
                       </head>
                       <body>
                         <h1>Bookmark These Links</h1>
                         <div class="instructions">
                           <p>To bookmark all these links:</p>
                           <ol>
                             <li>Press <strong>Ctrl+D</strong> or <strong>⌘+D</strong> to bookmark this page</li>
                             <li>Create a new folder named "\${folderName}" for the bookmark</li>
                             <li>Then, right-click this page and choose "Bookmark all tabs" if you want to save the actual links</li>
                           </ol>
                         </div>
                         <h2>Links to Bookmark:</h2>
                         <ul>
                           \${selectedLinks.map(link => \`<li><a href="\${link.url}" target="_blank">\${link.url}</a></li>\`).join('')}
                         </ul>
                         <p>Links exported by PistonPry on \${new Date().toLocaleString()}</p>
                       </body>
                     </html>
                   \`;
                   
                   window.open('data:text/html;charset=UTF-8,' + encodeURIComponent(bookmarkPageContent), '_blank');
                 }
                 
                 // Toggle select all checkboxes
                 function toggleSelectAll() {
                   const selectAll = document.getElementById('selectAllLinks').checked;
                   document.querySelectorAll('li:not([style*="display: none"]) input.link-checkbox').forEach(cb => {
                     cb.checked = selectAll;
                   });
                 }
                 
                 // Select links by type
                 function selectByType() {
                   const availableTypes = [...new Set(Array.from(document.querySelectorAll('li:not([style*="display: none"])'))
                     .map(li => li.getAttribute('data-type')))];
                     
                   const typeToSelect = prompt(
                     \`Select links by type. Available types:\\n\${availableTypes.join(', ')}\\n\\nEnter a type:\`, 
                     availableTypes[0]
                   );
                   
                   if (!typeToSelect) return;
                   
                   document.querySelectorAll('li:not([style*="display: none"])').forEach(li => {
                     const checkbox = li.querySelector('input.link-checkbox');
                     checkbox.checked = li.getAttribute('data-type') === typeToSelect;
                   });
                 }
                 
                 // Invert the current selection
                 function invertSelection() {
                   document.querySelectorAll('li:not([style*="display: none"]) input.link-checkbox').forEach(cb => {
                     cb.checked = !cb.checked;
                   });
                 }

                 // Apply filters based on all current filter settings
                 function applyFilters() {
                   const textFilter = document.getElementById('filterInput').value.toLowerCase();
                   const typeFilter = document.getElementById('typeFilter').value;
                   const locationFilter = document.getElementById('locationFilter').value;
                   
                   const items = document.querySelectorAll('li');
                   let count = 0;
                   
                   items.forEach(item => {
                     const link = item.querySelector('a').href.toLowerCase();
                     const type = item.getAttribute('data-type');
                     const isExternal = item.getAttribute('data-external') === 'true';
                     
                     // Check if the item matches all active filters
                     const matchesText = link.includes(textFilter);
                     const matchesType = !typeFilter || type === typeFilter;
                     const matchesLocation = !locationFilter || 
                                           (locationFilter === 'external' && isExternal) || 
                                           (locationFilter === 'internal' && !isExternal);
                     
                     if (matchesText && matchesType && matchesLocation) {
                       item.style.display = '';
                       count++;
                     } else {
                       item.style.display = 'none';
                     }
                   });
                   
                   document.getElementById('linkCount').textContent = count;
                 }
                 
                 // Reset all filters
                 function resetFilters() {
                   document.getElementById('filterInput').value = '';
                   document.getElementById('typeFilter').value = '';
                   document.getElementById('locationFilter').value = '';
                   applyFilters();
                 }
                 
                 // Export links in various formats
                 function exportLinks() {
                   const format = document.getElementById('exportFormat').value;
                   const visibleLinks = Array.from(document.querySelectorAll('li:not([style*="display: none"]) a')).map(a => a.href);
                   
                   if (visibleLinks.length === 0) {
                     alert('No links to export!');
                     return;
                   }
                   
                   let content = '';
                   let filename = 'extracted_links';
                   let mimeType = 'text/plain';
                   
                   switch (format) {
                     case 'text':
                       content = visibleLinks.join('\\n');
                       filename += '.txt';
                       break;
                     case 'csv':
                       content = 'URL\\n' + visibleLinks.map(link => '"' + link + '"').join('\\n');
                       filename += '.csv';
                       mimeType = 'text/csv';
                       break;
                     case 'json':
                       content = JSON.stringify(visibleLinks, null, 2);
                       filename += '.json';
                       mimeType = 'application/json';
                       break;
                     case 'markdown':
                       content = visibleLinks.map(link => '- [' + link + '](' + link + ')').join('\\n');
                       filename += '.md';
                       mimeType = 'text/markdown';
                       break;
                     case 'html':
                       content = '<ul>\\n' + visibleLinks.map(link => '  <li><a href="' + link + '">' + link + '</a></li>').join('\\n') + '\\n</ul>';
                       filename += '.html';
                       mimeType = 'text/html';
                       break;
                   }
                   
                   const blob = new Blob([content], { type: mimeType });
                   const url = URL.createObjectURL(blob);
                   
                   const a = document.createElement('a');
                   a.href = url;
                   a.download = filename;
                   document.body.appendChild(a);
                   a.click();
                   document.body.removeChild(a);
                   URL.revokeObjectURL(url);
                 }
                 
                 // Save the current collection
                 document.getElementById('saveCollectionForm').addEventListener('submit', function(e) {
                   e.preventDefault();
                   
                   const name = document.getElementById('collectionName').value.trim();
                   if (!name) {
                     alert('Please enter a collection name.');
                     return;
                   }
                   
                   const visibleLinks = Array.from(document.querySelectorAll('li:not([style*="display: none"]) a')).map(a => a.href);
                   if (visibleLinks.length === 0) {
                     alert('No links to save!');
                     return;
                   }
                   
                   // Get source URL from page
                   const sourceUrl = '${sourceUrl}';
                   
                   // Send message to background script to save collection
                   chrome.runtime.sendMessage({
                     action: 'saveCollection',
                     name,
                     links: visibleLinks,
                     sourceUrl
                   }, response => {
                     if (response.success) {
                       alert('Collection saved!');
                       document.getElementById('collectionName').value = '';
                       
                       // Update the collections list
                       const newCollection = response.collection;
                       const collectionsContainer = document.getElementById('collectionsContainer');
                       
                       if (collectionsContainer.innerHTML.includes('No saved collections yet')) {
                         collectionsContainer.innerHTML = '';
                       }
                       
                       const collectionHtml = \`
                         <div class="collection-item" data-id="\${newCollection.id}">
                           <div class="collection-header">
                             <h3>\${newCollection.name}</h3>
                             <div>
                               <span class="collection-count">\${newCollection.count} links</span>
                               <button class="view-collection" data-id="\${newCollection.id}">View</button>
                               <button class="delete-collection" data-id="\${newCollection.id}">Delete</button>
                             </div>
                           </div>
                           <div class="collection-meta">
                             Saved on \${new Date(newCollection.timestamp).toLocaleDateString()} from
                             <a href="\${newCollection.sourceUrl}" target="_blank">\${new URL(newCollection.sourceUrl).hostname}</a>
                           </div>
                         </div>
                       \`;
                       
                       collectionsContainer.insertAdjacentHTML('afterbegin', collectionHtml);
                       attachCollectionEventListeners();
                     } else {
                       alert('Failed to save collection: ' + response.error);
                     }
                   });
                 });
                 
                 // Tab switching
                 document.querySelectorAll('.tab').forEach(tab => {
                   tab.addEventListener('click', () => {
                     // Remove active class from all tabs and tab contents
                     document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                     document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                     
                     // Add active class to clicked tab and corresponding content
                     tab.classList.add('active');
                     const tabName = tab.getAttribute('data-tab');
                     document.getElementById(tabName + 'Tab').classList.add('active');
                   });
                 });
                 
                 // Handle collection actions (view, delete)
                 function attachCollectionEventListeners() {
                   // View collection
                   document.querySelectorAll('.view-collection').forEach(button => {
                     button.addEventListener('click', () => {
                       const collectionId = button.getAttribute('data-id');
                       chrome.runtime.sendMessage({
                         action: 'getCollection',
                         id: collectionId
                       }, response => {
                         if (response.collection) {
                           // Create a new tab with the collection
                           const linksHtml = response.collection.links
                             .map(link => \`<li><a href="\${link}" target="_blank" rel="noopener noreferrer">\${link}</a></li>\`)
                             .join('');
                             
                           const viewHtml = \`
                             <html>
                               <head>
                                 <title>\${response.collection.name} - Saved Links</title>
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
                                   h1 { margin-top: 0; }
                                   ul { 
                                      list-style-type: none; 
                                      padding-left: 0; 
                                   }
                                   li { 
                                      margin-bottom: 8px;
                                      padding: 8px;
                                      border: 1px solid #eee;
                                      border-radius: 4px;
                                   }
                                   li:hover { background: #f8f9fa; }
                                   a { 
                                      color: #0066cc;
                                      text-decoration: none;
                                      word-break: break-all;
                                   }
                                   a:hover { text-decoration: underline; }
                                   .meta {
                                      color: #666;
                                      font-size: 14px;
                                      margin-bottom: 20px;
                                   }
                                 </style>
                               </head>
                               <body>
                                 <div class="container">
                                   <h1>\${response.collection.name}</h1>
                                   <div class="meta">
                                     Saved on \${new Date(response.collection.timestamp).toLocaleDateString()} from
                                     <a href="\${response.collection.sourceUrl}" target="_blank">\${new URL(response.collection.sourceUrl).hostname}</a>
                                   </div>
                                   <ul>\${linksHtml}</ul>
                                 </div>
                               </body>
                             </html>
                           \`;
                           
                           chrome.tabs.create({ url: 'data:text/html;charset=UTF-8,' + encodeURIComponent(viewHtml) });
                         } else {
                           alert('Collection not found!');
                         }
                       });
                     });
                   });
                   