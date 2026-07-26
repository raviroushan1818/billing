#!/usr/bin/env bash
# Creates an Android upload keystore for Play Store signing (one-time).
# Run from the mobile/ directory:
#   ./scripts/create_upload_keystore.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
KEYSTORE="$ANDROID_DIR/upload-keystore.jks"
PROPS="$ANDROID_DIR/key.properties"

# Prefer Android Studio / Flutter JDK
if [[ -z "${JAVA_HOME:-}" ]]; then
  AS_JAVA="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  if [[ -x "$AS_JAVA/bin/java" ]]; then
    export JAVA_HOME="$AS_JAVA"
    export PATH="$JAVA_HOME/bin:$PATH"
  fi
fi

if [[ -f "$KEYSTORE" ]]; then
  echo "Keystore already exists: $KEYSTORE"
  echo "Delete it only if you intentionally want to rotate keys (Play upload key change required)."
  exit 1
fi

if [[ -f "$PROPS" ]]; then
  echo "key.properties already exists. Aborting to avoid overwriting secrets."
  exit 1
fi

ALIAS="upload"
KEYTOOL="keytool"
if ! command -v keytool >/dev/null 2>&1; then
  echo "keytool not found. Install a JDK or Android Studio."
  exit 1
fi

# 32-char random password (saved only in local key.properties, which is gitignored)
PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"

echo "Generating upload keystore..."
"$KEYTOOL" -genkey -v \
  -keystore "$KEYSTORE" \
  -storetype JKS \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias "$ALIAS" \
  -storepass "$PASSWORD" \
  -keypass "$PASSWORD" \
  -dname "CN=Billing System, OU=Mobile, O=Indian Softwares Services, L=India, ST=India, C=IN"

cat > "$PROPS" <<EOF
storePassword=$PASSWORD
keyPassword=$PASSWORD
keyAlias=$ALIAS
storeFile=../upload-keystore.jks
EOF

chmod 600 "$PROPS" "$KEYSTORE"

echo ""
echo "Created:"
echo "  $KEYSTORE"
echo "  $PROPS"
echo ""
echo "IMPORTANT: Back up upload-keystore.jks and key.properties in a secure vault."
echo "If you lose them, you cannot update the Play Store app with the same signing key"
echo "(unless you use Play App Signing and only lose the upload key — still painful)."
echo ""
echo "Next: ./scripts/build_play_bundle.sh"
