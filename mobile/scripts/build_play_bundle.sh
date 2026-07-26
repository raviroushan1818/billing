#!/usr/bin/env bash
# Builds a signed Play Store App Bundle (.aab) pointed at production API.
# Prerequisites: android/key.properties + android/upload-keystore.jks
#   (run ./scripts/create_upload_keystore.sh once)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Prefer Android Studio / Flutter JDK for Gradle
if [[ -z "${JAVA_HOME:-}" ]]; then
  AS_JAVA="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  if [[ -x "$AS_JAVA/bin/java" ]]; then
    export JAVA_HOME="$AS_JAVA"
    export PATH="$JAVA_HOME/bin:$PATH"
  fi
fi

API_BASE="${API_BASE:-https://billing.indiansoftwareservices.com/api}"
BUILD_NAME="${BUILD_NAME:-}"
BUILD_NUMBER="${BUILD_NUMBER:-}"

if [[ ! -f android/key.properties ]]; then
  echo "Missing android/key.properties"
  echo "Run: ./scripts/create_upload_keystore.sh"
  exit 1
fi

if [[ ! -f android/upload-keystore.jks ]]; then
  echo "Missing android/upload-keystore.jks"
  echo "Run: ./scripts/create_upload_keystore.sh"
  exit 1
fi

echo "Using API_BASE=$API_BASE"
flutter pub get

VERSION_ARGS=()
if [[ -n "$BUILD_NAME" ]]; then
  VERSION_ARGS+=(--build-name="$BUILD_NAME")
fi
if [[ -n "$BUILD_NUMBER" ]]; then
  VERSION_ARGS+=(--build-number="$BUILD_NUMBER")
fi

flutter build appbundle --release \
  --dart-define="API_BASE=$API_BASE" \
  ${VERSION_ARGS[@]+"${VERSION_ARGS[@]}"}

AAB="build/app/outputs/bundle/release/app-release.aab"
echo ""
echo "Play Bundle ready:"
echo "  $ROOT_DIR/$AAB"
ls -lh "$AAB"
echo ""
echo "Upload this file in Play Console → Production (or Internal testing) → Create release."
