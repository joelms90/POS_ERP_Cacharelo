# POS Flutter - Windows Installation Guide

## System Requirements

- Windows 10 (64-bit) or newer
- Windows 11 (recommended)
- 4GB RAM minimum
- 500MB free disk space
- Network printer or USB printer (for receipt printing)

## Installation Methods

### Method 1: Portable ZIP (No Installation Required)

**Recommended for quick deployment or testing:**

1. **Download** the ZIP file:
   - `POSFlutter-v1.0.0-windows.zip`

2. **Extract** the ZIP to any folder:
   - Right-click → Extract All
   - Choose location (e.g., `C:\POS\`)

3. **Run** the application:
   - Navigate to the extracted folder
   - Double-click `pos_flutter.exe`

4. **Optional - Create Desktop Shortcut:**
   - Right-click `pos_flutter.exe`
   - Send to → Desktop (create shortcut)

**Benefits:**
- ✅ No admin rights required
- ✅ Can run from USB drive
- ✅ Easy to update (just replace folder)
- ✅ Easy to uninstall (just delete folder)

### Method 2: Installer (Recommended for Permanent Installation)

**Recommended for production deployment:**

1. **Download** the installer:
   - `POSFlutter-Setup-v1.0.0.exe`

2. **Run** the installer:
   - Double-click the .exe file
   - May require administrator privileges
   - Choose language (Spanish/English)

3. **Follow** installation wizard:
   - Choose installation folder
   - Select if you want desktop icon
   - Click Install

4. **Launch** from:
   - Start Menu → POS Flutter
   - Desktop icon (if created)

**Benefits:**
- ✅ Proper Windows integration
- ✅ Start Menu shortcuts
- ✅ Automatic updates support
- ✅ Clean uninstallation

## First Run Configuration

### 1. Configure Terminal

On first launch:
1. Click **"Configurar Terminal"**
2. Enter your **Branch Code** (provided by admin)
3. Click **"Configurar"**

### 2. Configure Printer

1. Click the **⚙️ Settings** button (top right)
2. Select **"Configurar Impresora"**
3. Choose your printer from the list:
   - USB thermal printers
   - Network printers
   - WiFi printers
4. Click **"CONECTAR"**
5. Click **"PROBAR"** to test

### 3. Login

Use your PIN code to login:
- **Waiter:** 1111
- **Cashier:** 2222
- **Kitchen:** 3333

## Troubleshooting

### Printer Not Listed
- Ensure printer is installed in Windows
- Check: Settings → Printers & Scanners
- Install printer drivers if needed

### Network Connection Issues
- Check firewall settings
- Ensure internet connection
- Allow POS Flutter through Windows Firewall

### Application Won't Start
- Ensure Windows 10/11 64-bit
- Check antivirus isn't blocking
- Try running as Administrator

## Uninstallation

### If installed via Installer:
- Settings → Apps → POS Flutter → Uninstall

### If installed via ZIP:
- Simply delete the folder

## Support

For technical support, contact:
- GitHub Issues: https://github.com/your-repo/issues
- Email: support@example.com

---

**Version:** 1.0.0
**Last Updated:** 2026-07-05
