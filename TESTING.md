# HexFetch Testing Checklist

## Functional Smoke Tests

1. Open a standard website and click **Scan Colors**.
2. Confirm palette swatches render with count and copy action.
3. Confirm gradients render when page has gradients.
4. Toggle inspector from popup and verify hover overlay + tooltip.
5. Toggle inspector with keyboard shortcut (`Alt+Shift+I`).
6. Run quick scan with keyboard shortcut (`Alt+Shift+S`) and reopen popup.
7. Confirm quick scan hydration loads latest palette in popup.

## Export and Storage Tests

1. Click **Copy All Colors** and verify clipboard output.
2. Click **Export CSS Variables** and verify syntax.
3. Click **Export Tailwind Config** and verify syntax.
4. Click **Export Contrast Report** and verify markdown table.
5. Save a palette and confirm it appears in Saved Palettes.
6. Export saved palettes as JSON and verify file download.
7. Re-import exported JSON and verify palettes merge correctly.
8. Delete a saved palette and confirm persistence after reopening popup.

## Settings Tests

1. Set default sort to `hex-asc`, save settings, reopen popup.
2. Confirm sort selection persists.
3. Set contrast mode to `large`, save settings, reopen popup.
4. Confirm contrast mode persists.
5. Set max swatches to 20 and verify rendered swatches are capped.

## Reliability / Edge Cases

1. Open `chrome://extensions` and confirm scanning shows restricted-page error.
2. Open a newly loaded webpage and scan immediately to verify content script bootstrap works.
3. Try importing invalid JSON and confirm a clear error message is shown.
4. Try exporting saved JSON with no saved palettes and confirm warning message appears.

## Performance Spot Check

1. Open a large page and scan.
2. Verify popup remains responsive while rendering swatches.
3. Lower max swatches in settings and confirm faster rendering.
