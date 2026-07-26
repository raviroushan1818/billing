# Billing System (Mobile)

Production Flutter app for Indian Softwares Services billing — GST invoices, POS, stock, and receivables.

**Package ID:** `com.indiansoftwareservices.billing`  
**Default API:** `https://billing.indiansoftwareservices.com/api`

## Play Store release (Android App Bundle)

### 1. One-time: create upload keystore

```bash
cd mobile
./scripts/create_upload_keystore.sh
```

This creates (gitignored):

- `android/upload-keystore.jks`
- `android/key.properties`

Back these up in a password manager / secure vault. Losing them blocks updates signed with the same upload key.

### 2. Build the signed `.aab`

```bash
cd mobile
./scripts/build_play_bundle.sh
```

Optional overrides:

```bash
BUILD_NAME=1.0.1 BUILD_NUMBER=2 ./scripts/build_play_bundle.sh
API_BASE=https://billing.indiansoftwareservices.com/api ./scripts/build_play_bundle.sh
```

Output:

`build/app/outputs/bundle/release/app-release.aab`

### 3. Upload in Google Play Console

1. Create app → package name must match `com.indiansoftwareservices.billing`
2. Enable **Play App Signing** (recommended)
3. Production or Internal testing → Create release → upload the `.aab`
4. Complete Store listing, Content rating, Privacy policy, Data safety

### Version bumps

Edit `pubspec.yaml` `version: X.Y.Z+N`:

- `X.Y.Z` → `versionName` (user-visible)
- `N` → `versionCode` (must increase for every Play upload)

## Local run

```bash
flutter pub get
flutter run
```

Release on a device (requires keystore for a true release signature):

```bash
flutter run --release --dart-define=API_BASE=https://billing.indiansoftwareservices.com/api
```

## Store listing checklist

- [ ] App name: Billing System
- [ ] Short description (≤80 chars)
- [ ] Full description
- [ ] Icon 512×512
- [ ] Feature graphic 1024×500
- [ ] Phone screenshots (min 2)
- [ ] Privacy policy URL (required if you collect account / business data)
- [ ] Data safety form (auth, invoices, device identifiers as applicable)
- [ ] Content rating questionnaire
- [ ] Target audience / news apps declarations if prompted
