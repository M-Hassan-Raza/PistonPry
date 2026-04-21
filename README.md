# PistonPry

PistonPry is a Chrome extension for extracting visible links, images, and contacts from a page region, a picked set of elements, or the full page.

## What It Does

- Draw a region on any page and extract visible items inside it.
- Pick individual links with `Alt+Click`.
- Extract all visible items from the current page with the keyboard shortcut.
- Copy, export, share, clean, and health-check extracted URLs.
- Save extractions into collections and revisit them later from history.

## Local Development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Build the extension bundle:

   ```bash
   pnpm build
   ```

3. Load the built extension from `dist/` in `chrome://extensions`.

## Verification

- Run the focused unit tests:

  ```bash
  pnpm test
  ```

- Rebuild the extension bundle:

  ```bash
  pnpm build
  ```

## Main Capabilities

- Region extraction for links, images, and contacts
- Full-page extraction
- Context-menu extraction from a section
- URL cleaning for common tracking parameters
- Link health checks with runtime host-permission requests
- Grouping, filtering, sorting, deduping, and keyboard navigation
- Saved collections, imports, comparisons, and history replay
- Plain text, CSV, JSON, Markdown, and HTML exports

## Permissions

- `activeTab`: inject the extraction flow into the current page
- `scripting`: run the content script and page notifications
- `storage`: persist collections, settings, and history
- `contextMenus`: add the section-extraction context menu
- `optional_host_permissions`: request site access only when the user runs link health checks
