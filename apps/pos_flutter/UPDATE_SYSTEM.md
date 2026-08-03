# POS Flutter Update System

## Overview

The POS Flutter app includes an automatic update checking system that notifies users when new versions are available for their platform (Web, Android, Windows).

## Architecture

### 1. **Metadata Generation (CI/CD)**
   - GitHub Actions workflows automatically generate version metadata after successful builds
   - Script: `.github/scripts/generate-metadata.sh`
   - Metadata uploaded to: `gs://cacharelo-pos-releases/metadata.json`

### 2. **Version Service** (`lib/services/version_service.dart`)
   - Fetches metadata from Cloud Storage
   - Compares current version with latest release
   - Handles platform-specific download logic
   - Caches results for 1 hour to reduce API calls

### 3. **Update UI** (`lib/ui/common/update_dialog.dart`)
   - `UpdateCheckButton`: Shows in login screen footer
   - `UpdateDialog`: Displays update information and download options
   - Automatically checks for updates 2 seconds after login screen loads

## How It Works

### Web Platform
- **Update Check**: Compares metadata version with current deployment
- **Update Process**: Shows "Reload App" button to refresh the page
- **Note**: Firebase Hosting auto-serves latest version; reload ensures fresh cache

### Android Platform
- **Update Check**: Fetches APK metadata from Cloud Storage
- **Update Process**: Opens download URL in external browser
- **User Action Required**: User must install APK manually

### Windows Platform
- **Update Check**: Fetches ZIP metadata from Cloud Storage
- **Update Process**: Opens download URL in browser
- **User Action Required**:
  1. Download ZIP
  2. Close application
  3. Extract and replace files
  4. Run `pos_flutter.exe`

## Metadata Format

```json
{
  "lastUpdated": "2026-07-18T10:30:00Z",
  "currentVersion": "1.0.0",
  "platforms": {
    "web": {
      "version": "v1.0.0-20260718-103000",
      "downloadUrl": "https://storage.googleapis.com/.../web/pos_flutter_web_latest.tar.gz",
      "size": "12.5M",
      "commit": "abc123...",
      "branch": "main",
      "buildDate": "2026-07-18T10:30:00Z"
    },
    "android": {
      "version": "v1.0.0-20260718-103100",
      "downloadUrl": "https://storage.googleapis.com/.../android/pos_flutter_android_latest.apk",
      "size": "23.1 MB",
      "commit": "abc123...",
      "branch": "main",
      "buildDate": "2026-07-18T10:31:00Z"
    },
    "windows": {
      "version": "v1.0.0-20260718-103200",
      "downloadUrl": "https://storage.googleapis.com/.../windows/pos_flutter_windows_latest.zip",
      "size": "45.2 MB",
      "commit": "abc123...",
      "branch": "main",
      "buildDate": "2026-07-18T10:32:00Z"
    }
  }
}
```

## Configuration

### Dependencies
Add to `pubspec.yaml`:
```yaml
dependencies:
  package_info_plus: ^8.1.2  # Get current app version
  url_launcher: ^6.3.1       # Open download URLs
```

### Metadata URL
Configured in `version_service.dart`:
```dart
static const String metadataUrl =
    'https://storage.googleapis.com/cacharelo-pos-releases/metadata.json';
```

## Usage

### In Login Screen
The update button is automatically added to the footer:
```dart
import 'common/update_dialog.dart';

// In footer section:
const UpdateCheckButton()
```

### Manual Check
```dart
import 'package:pos_flutter/services/version_service.dart';

// Check for updates
final result = await VersionService.checkForUpdates();

if (result.updateAvailable) {
  // Show update dialog or notification
}
```

## Workflow Integration

### Web Deploy (`web-deploy.yml`)
```yaml
- name: Update version metadata
  run: |
    .github/scripts/generate-metadata.sh \
      "web" \
      "$VERSION" \
      "https://storage.googleapis.com/.../web/pos_flutter_web_latest.tar.gz" \
      "$SIZE" \
      "$COMMIT_SHA" \
      "$BRANCH"
```

### Android Build (`android-release.yml`)
```yaml
- name: Update version metadata
  run: |
    .github/scripts/generate-metadata.sh \
      "android" \
      "$VERSION" \
      "https://storage.googleapis.com/.../android/pos_flutter_android_latest.apk" \
      "$SIZE" \
      "$COMMIT_SHA" \
      "$BRANCH"
```

### Windows Build (`windows-release.yml`)
```yaml
- name: Update version metadata
  run: |
    bash .github/scripts/generate-metadata.sh \
      "windows" \
      "$VERSION" \
      "https://storage.googleapis.com/.../windows/pos_flutter_windows_latest.zip" \
      "$SIZE" \
      "$COMMIT_SHA" \
      "$BRANCH"
```

## Testing

### Test Update Check
```dart
// In your test file
void main() {
  test('Version check returns valid result', () async {
    final result = await VersionService.checkForUpdates();
    expect(result.error, isNull);
  });
}
```

### Manual Testing Checklist
1. ✅ Deploy new version to main branch
2. ✅ Wait for CI/CD to complete (metadata updated)
3. ✅ Open login screen
4. ✅ Click "Buscar Actualizaciones"
5. ✅ Verify dialog shows correct information
6. ✅ Test download button (platform-specific)

## Troubleshooting

### Update Check Fails
- **Cause**: Network error or metadata.json not accessible
- **Solution**: Check Cloud Storage permissions and URL

### Version Always Shows "Up to Date"
- **Cause**: Version comparison logic not detecting differences
- **Solution**: Verify version format in metadata vs. pubspec.yaml

### Download Doesn't Start
- **Cause**: `url_launcher` can't open URL
- **Solution**: Check URL format and platform permissions

## Security Considerations

1. **Metadata Endpoint**: Publicly readable (no auth required)
2. **Download URLs**: Public Cloud Storage URLs
3. **No Auto-Install**: Users must manually install updates
4. **HTTPS Only**: All URLs use secure connections

## Future Enhancements

- [ ] Semantic version comparison (use `version` package)
- [ ] In-app download progress indicator
- [ ] Auto-install for Android (using `install_plugin`)
- [ ] Release notes/changelog display
- [ ] Background update checks
- [ ] Update notifications (push notifications)
- [ ] Rollback mechanism for failed updates

## Related Files

- `lib/services/version_service.dart` - Core version checking logic
- `lib/ui/common/update_dialog.dart` - UI components
- `lib/ui/login_screen.dart` - Integration point
- `.github/scripts/generate-metadata.sh` - Metadata generation
- `.github/workflows/web-deploy.yml` - Web deployment
- `.github/workflows/android-release.yml` - Android build
- `.github/workflows/windows-release.yml` - Windows build
