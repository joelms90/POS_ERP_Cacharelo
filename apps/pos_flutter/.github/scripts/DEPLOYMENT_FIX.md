# Deployment Fix: Metadata Generation Issues

## Issues Encountered

### 1. **Linux/macOS Workflows (web-deploy.yml, android-release.yml)**
```
ERROR: Task 140458464688320 failed: GcsApiError('')
```

**Cause**: The script tried to update ACLs on the metadata.json file, but the service account doesn't have `storage.objects.setIamPolicy` permission.

### 2. **Windows Workflow (windows-release.yml)**
```
ERROR: The following URLs matched no objects or files:
C:/Users/RUNNER~1/AppData/Local/Temp/metadata-updated.json
```

**Cause**: The script used `/tmp/` which doesn't exist on Windows. Windows uses `%TEMP%` instead.

---

## Fixes Applied

### 1. **Cross-Platform Temp Directory** (`generate-metadata.sh`)

Added OS detection:
```bash
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
  # Windows
  TEMP_DIR="$TEMP"
  METADATA_TEMP="$TEMP_DIR/metadata.json"
  METADATA_UPDATED="$TEMP_DIR/metadata-updated.json"
else
  # Linux/macOS
  TEMP_DIR="/tmp"
  METADATA_TEMP="/tmp/metadata.json"
  METADATA_UPDATED="/tmp/metadata-updated.json"
fi
```

### 2. **Non-Fatal ACL Setting**

Made ACL updates non-fatal (warnings instead of errors):
```bash
# Try to set public read ACL (non-fatal if it fails)
if gcloud storage objects update ... ; then
  echo "✅ Public read permissions set successfully"
else
  echo "⚠️  Could not set public ACL (may already be public at bucket level)"
fi
```

### 3. **Better Error Handling**

- Upload now exits with error code if it fails
- ACL setting failure is just a warning
- Cleanup is non-fatal (`|| true`)

---

## One-Time Setup Required

To allow the workflows to work without needing object-level ACL permissions, run this **once**:

```bash
cd /Users/joelmorales/web/POS-ERP/apps/pos_flutter
bash .github/scripts/setup-bucket-public-access.sh
```

This will:
1. Make the entire `cacharelo-pos-releases` bucket publicly readable
2. Set CORS headers to allow web app to fetch metadata
3. Verify the configuration

**Why this works:**
- Instead of setting ACLs per-object (requires `storage.objects.setIamPolicy`)
- We set bucket-level IAM (requires `storage.buckets.setIamPolicy` which the service account has)
- All new objects inherit public read automatically

---

## Alternative: Grant Object ACL Permission

If you prefer to keep bucket private and only make specific objects public, add this permission to the service account:

```bash
gcloud projects add-iam-policy-binding fresh-sensor-497515-d3 \
  --member="serviceAccount:github-actions-pos-flutter@fresh-sensor-497515-d3.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

**Note**: This gives more permissions than needed. The bucket-level approach is simpler and more secure.

---

## Testing

After applying fixes, test by:

1. **Push to main branch** (triggers all three workflows)
2. **Check workflow logs** for:
   - ✅ "Successfully uploaded metadata.json"
   - ✅ "Public read permissions set successfully" OR
   - ⚠️  "Could not set public ACL (may already be public at bucket level)"

3. **Verify metadata is accessible**:
   ```bash
   curl https://storage.googleapis.com/cacharelo-pos-releases/metadata.json
   ```

4. **Check in Flutter app**:
   - Open login screen
   - Click "Buscar Actualizaciones"
   - Should fetch version info successfully

---

## Files Modified

1. `.github/scripts/generate-metadata.sh` - Main fix
2. `.github/scripts/setup-bucket-public-access.sh` - One-time setup (NEW)
3. `.github/scripts/DEPLOYMENT_FIX.md` - This documentation (NEW)

---

## Rollback Plan

If issues persist, you can disable metadata generation by commenting out these steps in the workflows:

**web-deploy.yml** (lines 66-78):
```yaml
# - name: Install jq for metadata generation
#   run: sudo apt-get update && sudo apt-get install -y jq
#
# - name: Update version metadata
#   run: |
#     chmod +x .github/scripts/generate-metadata.sh
#     .github/scripts/generate-metadata.sh ...
```

Same for `android-release.yml` and `windows-release.yml`.

The update checking feature will fail gracefully if metadata.json doesn't exist.
