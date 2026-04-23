# HexFetch Release Checklist

## Version and Manifest

1. Update `version` in `manifest.json`.
2. Verify `manifest_version` is 3.
3. Confirm permissions are minimal and accurate.
4. Confirm command shortcuts and descriptions are present.

## Final QA

1. Run full checklist in `TESTING.md`.
2. Verify extension behavior on at least 3 real websites.
3. Verify keyboard command behavior on Linux, macOS, and Windows if possible.

## Packaging

1. Ensure project root includes only necessary production files.
2. Remove temporary files or local experiments.
3. Create final zip package from project root.

## Store Readiness

1. Prepare screenshots for popup, inspector mode, and saved palettes.
2. Prepare concise extension description and feature list.
3. Document known limitations (restricted pages, CWS pages, browser internal pages).
