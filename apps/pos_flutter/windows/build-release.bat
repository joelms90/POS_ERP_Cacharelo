@echo off
REM POS Flutter - Windows Build Script
REM Run this on a Windows machine to build the release version

echo ========================================
echo POS Flutter - Windows Release Builder
echo ========================================
echo.

cd /d "%~dp0.."

echo [1/4] Cleaning previous builds...
call flutter clean
echo.

echo [2/4] Getting dependencies...
call flutter pub get
echo.

echo [3/4] Building Windows release...
call flutter build windows --release
echo.

echo [4/4] Creating distribution package...
set BUILD_DIR=build\windows\x64\runner\Release
set DIST_DIR=build\windows\distribution
set VERSION=1.0.0

if exist "%DIST_DIR%" rmdir /s /q "%DIST_DIR%"
mkdir "%DIST_DIR%"

echo Copying files to distribution folder...
xcopy "%BUILD_DIR%" "%DIST_DIR%\POS-Flutter" /E /I /H /Y

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo Distribution folder: %DIST_DIR%
echo.
echo Next steps:
echo 1. ZIP the folder for portable distribution:
echo    Right-click "POS-Flutter" ^> Send to ^> Compressed folder
echo.
echo 2. OR create installer with Inno Setup:
echo    Open windows\installer.iss in Inno Setup Compiler
echo.
echo Application: %DIST_DIR%\POS-Flutter\pos_flutter.exe
echo.
pause
