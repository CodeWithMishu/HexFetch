# HexFetch

HexFetch is a Manifest V3 Chrome extension that extracts, analyzes, and exports webpage color palettes.

## Features

- Extracts colors from page computed styles (`color`, `background-color`, `border-color`)
- Converts RGB/RGBA values to HEX and removes duplicates
- Sorts colors by usage frequency
- Detects gradients (`linear-gradient`, `radial-gradient`) and extracts color stops
- Runs WCAG contrast checks for likely text/background pairs
- Developer-focused popup with dark UI and copy/export actions
- Palette search and sort controls for fast analysis
- Inspector mode with hover highlight and tooltip color details
- Save palettes locally with load/copy/delete actions
- Export and import saved palettes as JSON
- Keyboard shortcuts for quick scan and inspector toggle
- Contrast report export as markdown
- Persisted settings for default sort, contrast mode, and max rendered swatches

## Project Structure

- `manifest.json`
- `popup.html`
- `popup.css`
- `popup.js`
- `content.js`
- `utils.js`
- `background.js`

## Load In Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select this folder
5. Open any normal webpage and click the HexFetch extension icon
6. Reload extension after manifest changes during development

## How It Works

1. Popup requests extraction using `chrome.tabs.sendMessage`
2. Content script traverses `document.querySelectorAll("*")`
3. Content script collects computed styles and aggregates color frequencies
4. Result is returned to popup and rendered as swatches
5. Exports copy generated snippets to clipboard
6. Background service worker listens for keyboard commands
7. Popup and background auto-bootstrap content script when needed

## Palette Controls

- Search colors by HEX using the palette search field
- Sort colors by usage, hex, or luminance order
- Sorting and search work alongside role filters (All, Text, Background, Border)

## Settings

- Set default sort mode for new popup sessions
- Set default contrast mode (normal text or large text)
- Set max swatches rendered per scan for performance tuning

## Inspector Mode

- Toggle from popup
- Hover highlights element
- Tooltip shows text/background/border colors
- Click locks current element, click again unlocks
- Keyboard toggle shortcut: `Alt+Shift+I`

## Contrast Checks

- Compares top text and background candidates from detected roles
- Computes contrast ratio and labels results as AAA, AA, or Fail
- Supports normal-text and large-text WCAG thresholds
- Includes filter chips to view all, pass-only, AAA-only, or failing pairs
- Shows quick visual preview of each pair in the popup
- Adds one-click copy for CSS token snippets from any pair
- Export a markdown report using **Export Contrast Report**

## Saved Palette JSON Backup

- Export all saved palettes with **Export Saved JSON**
- Restore backups with **Import Saved JSON**
- Imported palettes are merged by palette id and sorted by saved date

## Keyboard Commands

- `Alt+Shift+S`: quick scan active tab, stores last result for popup hydration
- `Alt+Shift+I`: toggle inspector mode on the active tab

## Reliability Notes

- HexFetch cannot run on browser-internal pages (`chrome://`, extension pages, and similar restricted URLs)
- Popup and command flows automatically re-inject `content.js` when a page is newly loaded

## QA and Release

- Functional and edge-case checklist: `TESTING.md`
- Release packaging checklist: `RELEASE_CHECKLIST.md`

## Local Storage

Saved palettes are stored under the key `hexfetchSavedPalettes` in `chrome.storage.local`.

## Future Improvements

- Add screenshot capture and palette thumbnails
- Add nearest-color clustering and alias naming suggestions
- Add per-project palette tagging and pinning
