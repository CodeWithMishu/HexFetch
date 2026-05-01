#!/bin/bash
# HexFetch Installation Script for macOS and Linux

echo "🎨 Installing HexFetch..."

# Download the latest release
curl -L https://github.com/yourusername/HexFetch/releases/download/latest/HexFetch.zip -o HexFetch.zip

# Extract the zip file
unzip -q HexFetch.zip

# Cleanup
rm HexFetch.zip

echo "✅ HexFetch extracted successfully!"
echo ""
echo "📖 Next steps:"
echo "1. Open Chrome and go to: chrome://extensions"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Click 'Load unpacked'"
echo "4. Select the HexFetch folder"
echo ""
echo "🚀 Done! Click the HexFetch icon to start extracting colors."
