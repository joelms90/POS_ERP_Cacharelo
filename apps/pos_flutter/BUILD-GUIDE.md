# POS Flutter - Build & Release Guide

Complete guide for building and distributing POS Flutter across all platforms.

## Quick Reference

| Platform | Command | Output |
|----------|---------|--------|
| **Android APK + AAB** | `make flutter-android-build` | APK + AAB files |
| **macOS App** | `make flutter-macos-build` | .app bundle |
| **Windows Exe** | `make flutter-windows-build` | .exe (Windows only) |
| **Web** | `make flutter-web-build` | Static web files |
| **All Desktop** | `make flutter-desktop-releases` | macOS + Windows |
| **All Platforms** | `make flutter-all-releases` | Everything |

## Prerequisites

### All Platforms
- Flutter SDK 3.12.0+
- Git

### Android
- Android Studio
- Android SDK
- Java JDK 11+

### iOS (not currently needed)
- Xcode 14+
- CocoaPods
- macOS host required

### macOS
- macOS 10.15+
- Xcode Command Line Tools

### Windows
- Windows 10/11
- Visual Studio 2022 with C++ desktop development

### Web
- Any platform with Flutter
- Chrome for testing

## Building Releases

### 1. Android Release

```bash
# Build both APK and AAB
make flutter-android-build
```

**Outputs:**
- **APK:** `build/app/outputs/flutter-apk/app-release.apk` (~68MB)
  - Direct installation on Android devices
  - Requires "Install from Unknown Sources"

- **AAB:** `build/app/outputs/bundle/release/app-release.aab` (~60MB)
  - Google Play Store distribution
  - Upload to Play Console

**Signing (Required for Production):**

1. Create keystore:
```bash
keytool -genkey -v -keystore ~/keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

2. Create `android/key.properties`:
```properties
storePassword=<password>
keyPassword=<password>
keyAlias=upload
storeFile=<path-to-keystore>
```

3. Update `android/app/build.gradle` (already configured)

### 2. macOS Release

```bash
# Build macOS app bundle
make flutter-macos-build
```

**Output:**
- `build/macos/Build/Products/Release/pos_flutter.app`

**Distribution Options:**

**Option A: Direct .app**
```bash
# Copy to Applications
cp -r build/macos/Build/Products/Release/pos_flutter.app /Applications/

# Or ZIP for sharing
cd build/macos/Build/Products/Release
zip -r POSFlutter-macOS-v1.0.0.zip pos_flutter.app
```

**Option B: DMG Installer**
```bash
brew install create-dmg

create-dmg \
  --volname "POS Flutter Installer" \
  --window-pos 200 120 \
  --window-size 600 400 \
  --icon-size 100 \
  --app-drop-link 425 120 \
  "POSFlutter-v1.0.0-macOS.dmg" \
  "build/macos/Build/Products/Release/pos_flutter.app"
```

**First Launch on User Machines:**
```bash
# Remove quarantine attribute
xattr -cr /Applications/pos_flutter.app

# Or in System Settings
# Security & Privacy → Open Anyway
```

### 3. Windows Release

**On Windows PC:**

```bash
# Build Windows executable
make flutter-windows-build

# Or use the batch script
cd windows
build-release.bat
```

**Output:**
- `build/windows/x64/runner/Release/`
  - `pos_flutter.exe` (main executable)
  - DLLs and data folder

**Distribution Options:**

**Option A: ZIP Distribution**
```batch
# Compress Release folder
cd build\windows\x64\runner
powershell Compress-Archive -Path Release -DestinationPath POSFlutter-Windows-v1.0.0.zip
```

**Option B: Installer with Inno Setup**

1. Install Inno Setup: https://jrsoftware.org/isdl.php

2. Open `windows/installer.iss`

3. Compile to create installer EXE

4. Distribute the installer:
   - `POSFlutter-Setup-v1.0.0.exe`

### 4. Web Release

```bash
# Build web version
make flutter-web-build

# Deploy to Firebase
make flutter-web-deploy
```

**Output:**
- `build/web/` - Static files

**Self-Hosting:**
```bash
# Test locally
make flutter-web-serve
# Open http://localhost:8000

# Deploy to any static host
# - Firebase Hosting (configured)
# - AWS S3
# - Netlify
# - Vercel
# - GitHub Pages
```

### 5. Build All Platforms

```bash
# Build everything at once
make flutter-all-releases
```

This builds:
- ✅ Web
- ✅ Android (APK + AAB)
- ✅ macOS (if on Mac)
- ✅ Windows (if on Windows)

## Release Checklist

### Pre-Build
- [ ] Update version in `pubspec.yaml`
- [ ] Update CHANGELOG.md
- [ ] Run tests: `make test`
- [ ] Run linter: `make lint`
- [ ] Clean previous builds: `make flutter-clean`

### Android
- [ ] Configure signing keystore
- [ ] Test APK on real device
- [ ] Test different Android versions (8.0+)
- [ ] Verify printer functionality
- [ ] Test offline mode
- [ ] Check Play Store requirements

### macOS
- [ ] Test on macOS 10.15+
- [ ] Verify system printer access
- [ ] Test network API calls
- [ ] Check storage functionality
- [ ] Create DMG if distributing
- [ ] Test on clean macOS install

### Windows
- [ ] Test on Windows 10/11
- [ ] Verify system printer access
- [ ] Test network API calls
- [ ] Create installer with Inno Setup
- [ ] Test on clean Windows install
- [ ] Check Windows Defender doesn't flag

### Web
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test responsive design
- [ ] Verify PWA functionality
- [ ] Test on mobile browsers
- [ ] Deploy to staging first

## Version Management

Update version in `pubspec.yaml`:

```yaml
version: 1.0.0+1
#        ^^^^^ ^
#        |     |
#        |     +-- Build number (increment for each release)
#        +-------- Version name (semantic versioning)
```

**Semantic Versioning:**
- **MAJOR**: Breaking changes (2.0.0)
- **MINOR**: New features (1.1.0)
- **PATCH**: Bug fixes (1.0.1)

**Build Number:**
- Increment for every release
- Used by app stores for updates

## Distribution Channels

### Android
1. **Direct APK:** Send file directly to users
2. **Google Play:** Upload AAB to Play Console
3. **Private:** Host on internal server

### macOS
1. **Direct .app:** Share via ZIP/DMG
2. **Mac App Store:** Requires Apple Developer account ($99/year)
3. **Homebrew Cask:** For tech-savvy users

### Windows
1. **Direct ZIP:** Extract and run
2. **Installer:** Professional distribution
3. **Microsoft Store:** Requires developer account
4. **Chocolatey:** Package manager distribution

### Web
1. **Firebase Hosting:** `make flutter-web-deploy`
2. **Custom Domain:** Configure in Firebase
3. **Self-hosted:** Upload `build/web/` to any server

## Troubleshooting

### Build Failures

**Android:**
```bash
# Clear Gradle cache
cd android
./gradlew clean
cd ..
flutter clean
```

**macOS:**
```bash
# Clean derived data
rm -rf ~/Library/Developer/Xcode/DerivedData
flutter clean
```

**Windows:**
```bash
# Clean build artifacts
flutter clean
rmdir /s /q build
```

### Signing Issues

**Android keystore lost:**
- Generate new keystore
- Increment version number
- Publish as new app (can't update existing)

**macOS code signing:**
- For development: Sandbox disabled in `DebugProfile.entitlements`
- For distribution: Need Apple Developer account

### Common Errors

**Error: "Gradle task assembleRelease failed"**
```bash
cd android
./gradlew clean
./gradlew assembleRelease --stacktrace
```

**Error: "Pod install failed"**
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
```

**Error: "Windows build not found"**
- Ensure you're on Windows host
- Install Visual Studio 2022 with C++ tools

## File Sizes

Approximate release sizes:

| Platform | Size | Notes |
|----------|------|-------|
| Android APK | ~68MB | Direct install |
| Android AAB | ~60MB | Play Store (downloads smaller) |
| macOS App | ~45MB | Universal binary |
| Windows | ~50MB | Including DLLs |
| Web | ~5MB | Gzipped |

## Support & Resources

- **Installation Guides:**
  - [INSTALL-WINDOWS.md](INSTALL-WINDOWS.md)
  - [INSTALL-MACOS.md](INSTALL-MACOS.md)

- **Flutter Documentation:**
  - Build & Release: https://docs.flutter.dev/deployment
  - Platform Integration: https://docs.flutter.dev/platform-integration

- **Store Publishing:**
  - Google Play Console: https://play.google.com/console
  - Mac App Store: https://developer.apple.com/app-store/
  - Microsoft Store: https://developer.microsoft.com/store

---

**Built with ❤️ using Flutter**
