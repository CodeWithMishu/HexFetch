@echo off
REM HexFetch Installation Script for Windows

echo Downloading HexFetch...
powershell -NoProfile -ExecutionPolicy Bypass -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/yourusername/HexFetch/releases/download/latest/HexFetch.zip' -OutFile 'HexFetch.zip'}"

echo Extracting files...
powershell -NoProfile -ExecutionPolicy Bypass -Command "& {Expand-Archive -Path 'HexFetch.zip' -DestinationPath '.'; Remove-Item 'HexFetch.zip'}"

echo.
echo ✓ HexFetch extracted successfully!
echo.
echo Next steps:
echo 1. Open Chrome and go to: chrome://extensions
echo 2. Enable "Developer mode" (toggle in top right)
echo 3. Click "Load unpacked"
echo 4. Select the HexFetch folder
echo.
echo Done! Click the HexFetch icon to start extracting colors.
echo.
pause
