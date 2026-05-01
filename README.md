# HexFetch

HexFetch is a Manifest V3 Chrome extension that extracts, analyzes, and exports webpage color palettes with support for multiple export formats, saved palette management, and real-time palette application.

## Features

### Core Color Extraction
- Extracts colors from page computed styles (`color`, `background-color`, `border-color`)
- Converts RGB/RGBA/HSL values to HEX and removes duplicates
- Sorts colors by usage frequency, hex value, or luminance
- Detects gradients (`linear-gradient`, `radial-gradient`) and extracts color stops
- Classifies colors by family (red, orange, green, blue, purple, pink, neutral)

### Palette Analysis & Export
- Runs WCAG contrast checks for likely text/background pairs with AAA/AA/Fail labels
- Export to multiple formats: **CSS, SCSS, Less, Tailwind, Design Tokens JSON**
- All exports both download as files and copy to clipboard simultaneously
- Color search and sort by usage, hex, or luminance
- Role-based filtering (All, Text, Background, Border)
- Contrast report export as markdown table

### Applied Palettes
- **Apply** the latest scanned palette to the current page as CSS variables
- Variables are injected into the page in real-time for live preview
- Page is outlined with accent glow when palette is applied
- **Clear applied palette** to remove injected CSS
- Keyboard shortcut: `Alt+Shift+A` (apply)

### Targeted Color Scanning
- **Scan Colors** scans the entire page
- **Scan Selected** with inspector lock target scans only that element and its children
- Useful for isolated component or section analysis
- Keyboard shortcut: `Alt+Shift+L` for locked-target scan

### Inspector Mode
- Toggle from popup or keyboard (`Alt+Shift+I`)
- Hover highlights any element with cyan outline
- Tooltip shows computed text, background, and border colors
- Click to lock element, click again to unlock
- Crosshair cursor when active

### Saved Palettes
- Save palettes with automatic name based on site hostname and date
- Each saved palette includes:
  - **Thumbnail screenshot** of the page when saved
  - **Color family tags** (red, blue, neutral, etc.) automatically assigned
  - **Custom notes** for each palette
  - **Pin/unpin** to keep frequently-used palettes at the top
  - **Summary** showing color family breakdown
- Load/copy/delete/share individual palettes
- Palettes persist in `chrome.storage.local` (max 50 stored)

### Palette Sharing
- **Copy Share Code** exports all saved palettes as a compact encoded string
- Share codes can be copied to clipboard and sent to colleagues
- **Import Share Code** via popup prompt to restore shared palettes
- Share codes are gzipped Base64-encoded for compact transmission
- Imported palettes merge with existing saved palettes by ID

### Manual Contrast Preview
- Select any two colors from the current palette
- **Preview Pair** button shows contrast ratio and WCAG rating
- Real-time preview text on sample "Aa Sample"
- Supports both normal and large text thresholds

### UI & Keyboard Shortcuts
- Developer-focused dark theme with cyan/emerald accents
- Hexagon logo in popup header
- 6 keyboard shortcuts (4 defaults + 2 assignable)
- Compact, responsive popup (380px width, scrollable sections)

### Settings
- Set default sort mode for new sessions
- Choose between normal and large text contrast thresholds
- Cap maximum swatches rendered for performance

## Project Structure

```
manifest.json      - Extension metadata, permissions, commands, icons
popup.html         - UI markup for popup window
popup.css          - Dark-theme styling, scrollable grid layouts
popup.js           - Main popup controller, state machine, event handlers
content.js         - Content script (color extraction, inspector, palette injection)
utils.js           - Shared utilities (color conversion, WCAG, export builders)
background.js      - Service worker (keyboard commands, badge updates)
logo.png           - Extension icon (16x16, 32x32, 48x48, 128x128)
```

## Installation for Users

### Option 1: Download Latest Release (Easiest)
1. Go to [Releases](https://github.com/yourusername/HexFetch/releases) on GitHub
2. Download the latest `HexFetch.zip`
3. Extract the zip file anywhere
4. Open `chrome://extensions` in your browser
5. Turn on **Developer mode** (toggle in top right)
6. Click **Load unpacked**
7. Select the extracted HexFetch folder
8. Done! Click the HexFetch icon on any website to get started

### Option 2: Clone from GitHub (For Developers)
```bash
git clone https://github.com/yourusername/HexFetch.git
cd HexFetch
```
Then follow steps 4-8 from Option 1.

## Development Setup

For contributors and developers:
1. Clone or download the repository
2. Open `chrome://extensions`
3. Turn on **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the HexFetch folder
6. Open any website and click the HexFetch icon in your toolbar
7. After code changes, reload the extension to see updates

## Quick Start

1. **Scan a page**: Click the HexFetch icon or press `Alt+Shift+S`
2. **View palette**: Swatches appear in the popup with colors sorted by frequency
3. **Search/filter**: Use the search box or role filters (Text, Background, Border)
4. **Apply to page**: Click **Apply Palette** to inject CSS variables
5. **Export**: Click any export button to download file AND copy to clipboard
6. **Save**: Click **Save Palette** to store with screenshot and custom notes
7. **Inspect**: Toggle Inspector (`Alt+Shift+I`) to hover/lock elements and see their colors

## Workflow Examples

### Extract and Export Palette
1. Open a website
2. Click HexFetch icon → **Scan Colors**
3. Review swatches, search, and filter by role
4. Click **CSS File + Copy** to export as CSS variables (file download + clipboard)
5. Click **Tailwind + Copy** to export as Tailwind config
6. Or choose **SCSS**, **Less**, or **Tokens + Copy** for other formats

### Apply Palette for Live Preview
1. After scanning, click **Apply Palette**
2. Page outline glows to show palette is applied
3. Open DevTools console to see `--hexfetch-color-1` through `--hexfetch-color-24` CSS variables
4. Use variables in page styles to preview: `color: var(--hexfetch-color-1);`
5. Click **Clear Applied** to remove injected CSS

### Analyze Specific Component
1. Open Inspector mode (`Alt+Shift+I` or **Toggle Inspector**)
2. Click on target component to lock it
3. Click **Scan Selected** to extract colors only from that component
4. View palette for that isolated section

### Save and Share Palettes
1. After scanning, click **Save Palette** to store with screenshot
2. Add tags and notes in the saved palette card
3. Click **Pin** to keep frequently-used palettes at the top
4. Click **Share** on a palette to copy its share code
5. Send the code to a colleague
6. They click **Import Share Code** and paste to restore

### Manual Contrast Testing
1. Scan a palette
2. Scroll to **Contrast Checks** section
3. Select a text color and background color from dropdowns
4. Click **Preview Pair** to see contrast ratio and WCAG rating
5. Adjust threshold between Normal and Large text as needed

## How It Works

### Architecture
1. **Popup** sends extraction request to content script via `chrome.tabs.sendMessage`
2. **Content script** traverses DOM with `document.querySelectorAll("*")`
3. **Content script** collects computed styles (color, background-color, border-color)
4. **Content script** converts RGB/RGBA/HSL to HEX and filters transparency
5. **Content script** classifies colors by role (text/background/border) and family
6. **Popup** receives result and renders swatches, gradients, contrast pairs
7. **Exports** generate formatted snippets and download files simultaneously
8. **Background service worker** listens for keyboard commands
9. **Popup/background** auto-bootstrap content script when needed
10. **Saved palettes** persist with tags, notes, pins, and screenshots

### Message Types
- `HEXFETCH_EXTRACT_COLORS` - Extract entire page palette
- `HEXFETCH_EXTRACT_TARGET_COLORS` - Extract colors from locked inspector element
- `HEXFETCH_APPLY_PALETTE` - Inject palette as CSS variables
- `HEXFETCH_CLEAR_APPLIED_PALETTE` - Remove injected CSS

## Export Formats

### CSS Variables
```css
:root {
  --color-1: #ffffff;
  --color-2: #000000;
  /* up to 24 colors */
}
```

### SCSS Variables
```scss
$color-1: #ffffff;
$color-2: #000000;
// up to 24 colors
```

### Less Variables
```less
@color-1: #ffffff;
@color-2: #000000;
// up to 24 colors
```

### Tailwind Config
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: "#ffffff",
        secondary: "#000000",
        // up to 24 colors
      }
    }
  }
};
```

### Design Tokens JSON
```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "colors": {
    "color-1": { "value": "#ffffff", "type": "color" },
    "color-2": { "value": "#000000", "type": "color" }
  }
}
```

## Keyboard Shortcuts

| Action | Default Shortcut | Notes |
| --- | --- | --- |
| **Quick Scan** | `Alt+Shift+S` | Scans entire page, stores result for popup |
| **Toggle Inspector** | `Alt+Shift+I` | Enable/disable color picker mode |
| **Scan Selected** | `Alt+Shift+L` | Scans locked inspector target element |
| **Apply Palette** | `Alt+Shift+A` | Applies latest scan as CSS variables to page |
| **Clear Applied** | (custom) | Removes injected CSS from page |
| **Save Palette** | (custom) | Saves latest scan with metadata |

To assign custom shortcuts:
1. Visit **Settings → Keyboard shortcuts** in your browser
2. Search for "HexFetch"
3. Click the pencil icon next to a command to set a new shortcut

## Color Classification

HexFetch automatically classifies colors into families:
- **Red**: Hues 0-24° and 345-360°
- **Orange/Yellow**: Hues 25-69°
- **Green**: Hues 70-164°
- **Blue**: Hues 165-254°
- **Purple**: Hues 255-319°
- **Pink**: Hues 320-344°
- **Neutral**: Low saturation colors (grays, blacks, whites)

Color families are automatically tagged when saving palettes and used for clustering.

## Contrast Ratio Thresholds (WCAG 2.1)

### Normal Text
- **AAA**: 7:1 or higher (enhanced contrast)
- **AA**: 4.5:1 or higher (minimum compliant)
- **Fail**: Below 4.5:1

### Large Text (≥18pt or ≥14pt bold)
- **AAA**: 4.5:1 or higher
- **AA**: 3:1 or higher
- **Fail**: Below 3:1

Contrast pairs are automatically analyzed and presented with visual preview.

## Permissions

- **activeTab**: Access to current tab URL
- **scripting**: Inject content script for color extraction
- **storage**: Persist saved palettes and settings
- **tabs**: Send messages to tab, capture visible tab screenshots
- **clipboardWrite**: Copy exports to clipboard
- **downloads**: Download exported files

## Storage Details

### Local Storage Keys
- `hexfetchSavedPalettes`: Array of saved palette objects with metadata
- `hexfetchSettings`: User preferences (sort, contrast threshold, max swatches)
- `hexfetchLastScan`: Latest scan result (used for keyboard command hydration)
- `hexfetchInspectorByTab`: Inspector state per tab ID

### Palette Object Schema
```javascript
{
  id: "timestamp",
  name: "Site Name YYYY-MM-DD",
  hostname: "example.com",
  savedAt: timestamp,
  colors: ["#ffffff", "#000000", ...],
  gradients: [{startColor, endColor}, ...],
  tags: ["family:red", "role:text", ...],
  summary: "12 colors, 3 gradients",
  pinned: false,
  note: "Custom notes about this palette",
  thumbnail: "data:image/png;base64,..."
}
```

## Troubleshooting

### Extension won't load
- Ensure `manifest.json` is valid JSON (check syntax)
- Verify all referenced files exist in the folder
- Reload the extension in `chrome://extensions`

### No colors showing after scan
- Try scanning a different website (some pages may have minimal computed colors)
- Check DevTools Console for error messages
- Ensure the page is fully loaded before scanning

### Share code import fails
- Verify the share code was copied completely (should contain alphanumeric characters)
- Check for extra whitespace at the beginning or end
- Try exporting local data and re-importing to verify integrity

### Screenshots not capturing
- Some websites restrict `captureVisibleTab` due to Content Security Policy (CSP)
- Palettes will save without thumbnail in restricted cases
- Screenshots are stored as Base64-encoded PNG in local storage

### Applied palette not showing
- Check that palette was actually applied (look for page outline glow)
- Verify page doesn't override CSS with `!important` or inline styles
- Try inspecting page for `--hexfetch-color-N` variables in DevTools

## Reliability Notes

- HexFetch cannot run on browser-internal pages (`chrome://`, `about:*`, extension pages)
- Popup and command flows automatically re-inject `content.js` when a page is newly loaded
- Large pages (1000+ elements) may take 1-2 seconds to extract colors
- Share codes are portable between browsers and machines
- All data is stored locally; no cloud sync or external servers

## Distribution

HexFetch is distributed free on GitHub (no Chrome Web Store fee required). Users can install via:
- **[GitHub Releases](https://github.com/yourusername/HexFetch/releases)** - Download and load unpacked
- **GitHub Clone** - `git clone` and load unpacked for developers

### Publishing a New Release
1. Test thoroughly using the TESTING.md checklist
2. Update version in `manifest.json`
3. Create a git tag: `git tag v1.0.0`
4. Push to GitHub: `git push origin main --tags`
5. Go to GitHub → Releases → Create Release
6. Attach a zip file of the extension folder
7. Users can download and install immediately

## QA and Release

- Functional and edge-case checklist: [TESTING.md](TESTING.md)
- Release packaging checklist: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)

## Development Notes

### Adding New Export Formats
1. Add builder function to `utils.js` (e.g., `buildMyFormatExport(colors)`)
2. Export function via `window.HexFetchUtils`
3. Add button in `popup.html` and wire event in `popup.js`
4. Call `exportTextAsset()` helper for consistent download + clipboard behavior

### Color Extraction Algorithm
1. Query all elements with `document.querySelectorAll("*")`
2. Get computed styles for each element
3. Extract `color`, `background-color`, and `border-color` properties
4. Convert RGB/RGBA/HSL to HEX format
5. Filter out transparent colors (rgba(0, 0, 0, 0))
6. Count frequency of each unique color
7. Classify by color family and assigned role
8. Sort by frequency and return aggregated palette

## Future Improvements

- Color name suggestions (e.g., "Slate", "Sky Blue") from common design systems
- Nearest-color clustering and palette simplification algorithms
- Accessibility audit for entire page (audit all contrast ratios)
- Integration with design tools (Figma, Adobe XD, Sketch plugins)
- Cloud sync and team collaboration features
- Multi-page batch scanning
- Custom color rules and filters
- Palette versioning and history tracking
