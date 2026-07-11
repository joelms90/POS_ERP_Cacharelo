# POS Flutter - macOS Installation Guide

## System Requirements

- macOS 10.15 (Catalina) or newer
- macOS 14 (Sonoma) recommended
- 4GB RAM minimum
- 500MB free disk space
- Network printer or USB printer (for receipt printing)

## Installation Methods

### Method 1: Direct App Bundle (Recommended)

**For local development or testing:**

1. **Navigate to the build folder:**
   ```bash
   cd apps/pos_flutter
   ```

2. **Build the app:**
   ```bash
   flutter build macos --release
   ```

3. **Find the app at:**
   ```
   build/macos/Build/Products/Release/pos_flutter.app
   ```

4. **Install:**
   - Drag `pos_flutter.app` to your Applications folder
   - OR double-click to run from current location

### Method 2: DMG Distribution (Professional)

**For distribution to other Macs:**

1. **Create a DMG installer** using `create-dmg`:
   ```bash
   # Install create-dmg
   brew install create-dmg

   # Build release version
   flutter build macos --release

   # Create DMG
   create-dmg \
     --volname "POS Flutter Installer" \
     --volicon "macos/Runner/Assets.xcassets/AppIcon.appiconset/app_icon_512.png" \
     --window-pos 200 120 \
     --window-size 600 400 \
     --icon-size 100 \
     --icon "pos_flutter.app" 175 120 \
     --hide-extension "pos_flutter.app" \
     --app-drop-link 425 120 \
     "POSFlutter-v1.0.0-macOS.dmg" \
     "build/macos/Build/Products/Release/pos_flutter.app"
   ```

2. **Distribute the DMG:**
   - Users double-click the DMG
   - Drag app to Applications folder
   - Eject DMG

## First Run Configuration

### 1. Bypass Gatekeeper (First Time Only)

macOS may block the app from an unidentified developer:

1. **If you see "Cannot open app":**
   - Open **System Settings** → **Privacy & Security**
   - Scroll down to see the blocked app
   - Click **"Open Anyway"**

2. **OR use Terminal:**
   ```bash
   xattr -cr /Applications/pos_flutter.app
   ```

### 2. Configure Terminal

On first launch:
1. Click **"Configurar Terminal"**
2. Enter your **Branch Code**
3. Click **"Configurar"**

### 3. Configure Printer

1. Click the **⚙️ Settings** button
2. Select **"Configurar Impresora"**
3. Choose from available macOS printers:
   - USB thermal printers
   - AirPrint printers
   - Network printers
4. Click **"CONECTAR"**
5. Click **"PROBAR"** to test

### 4. Login

Use your PIN code:
- **Waiter:** 1111
- **Cashier:** 2222
- **Kitchen:** 3333

## Troubleshooting

### "App is damaged and can't be opened"

This is a Gatekeeper issue. Fix with:
```bash
sudo xattr -rd com.apple.quarantine /Applications/pos_flutter.app
```

### Printer Not Listed

1. **Add printer to macOS:**
   - System Settings → Printers & Scanners
   - Click "+" to add printer

2. **Restart the app** after adding printer

### Network Connection Issues

- Check: System Settings → Network
- Ensure firewall allows the app
- System Settings → Privacy & Security → Firewall → Firewall Options

### Storage/Keychain Errors

The app automatically uses SharedPreferences if keychain access fails. No action needed.

## Development Mode

For developers running in debug mode:

```bash
cd apps/pos_flutter
flutter run -d macos
```

**Note:** App sandbox is disabled in debug mode for easier testing.

## Uninstallation

1. **Move to Trash:**
   - Open Applications folder
   - Drag `pos_flutter.app` to Trash

2. **Remove app data** (optional):
   ```bash
   rm -rf ~/Library/Preferences/com.example.posFlutter
   rm -rf ~/Library/Application\ Support/com.example.posFlutter
   ```

## Building from Source

```bash
# Clone repository
git clone https://github.com/your-repo/pos-erp.git
cd pos-erp/apps/pos_flutter

# Get dependencies
flutter pub get

# Build
flutter build macos --release

# App location
open build/macos/Build/Products/Release/
```

## Support

For technical support:
- GitHub Issues: https://github.com/your-repo/issues
- Documentation: See README.md

---

**Version:** 1.0.0
**Last Updated:** 2026-07-05
