# PistonPry

A Chrome extension that allows you to extract links from specific regions of a webpage by drawing a rectangle around them.

## Features

- Draw selection rectangles on any webpage
- Automatically extract all links within the selected region
- Simple and intuitive user interface
- Works on any webpage with active tab permissions

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the PistonPry directory

## Usage

1. Click the PistonPry icon in your Chrome toolbar
2. Click and drag on any webpage to draw a rectangle
3. Release to automatically extract all links within the selected region

## Permissions

This extension requires the following permissions:
- `activeTab`: To interact with the current webpage
- `scripting`: To inject content scripts for link extraction

## File Structure

```
PistonPry/
├── manifest.json       # Extension configuration
├── background.js      # Background service worker
├── content.js         # Content script for webpage interaction
└── images/           # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon120.png
```

## Version

Current version: 1.0

## License

I don't care what you do with this code. Go wild, have fun.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.