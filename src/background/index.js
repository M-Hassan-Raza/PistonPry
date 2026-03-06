import { setupContextMenu, handleContextMenuClick } from './contextMenu.js';
import { handleActionClick, handleExtractAllCommand } from './commands.js';
import { handleExtractedLinks } from './extraction.js';
import { handleCheckLinks } from './healthChecker.js';

// Context Menu
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);

// Action click (draw mode)
chrome.action.onClicked.addListener(handleActionClick);

// Keyboard command: full-page extract
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'extract_all') return;
  handleExtractAllCommand();
});

// Message router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractedLinks') {
    handleExtractedLinks(request, sender, sendResponse);
    return true;
  }

  if (request.action === 'checkLinks') {
    handleCheckLinks(request, sender, sendResponse);
    return true;
  }
});
