#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

signing_root="${HERDR_ANDROID_SIGNING_DIR:-${XDG_CONFIG_HOME:-${HOME}/.config}/herdr-mobile/android-signing}"
mkdir -p "$signing_root"
chmod 700 "$signing_root"
signing_root="$(cd "$signing_root" && pwd -P)"

keystore_file="$signing_root/herdr-release.p12"
credentials_file="$signing_root/release-signing.env"
key_alias="herdr-mobile"

if [[ ! -f "$keystore_file" || ! -f "$credentials_file" ]]; then
  if [[ -e "$keystore_file" || -e "$credentials_file" ]]; then
    echo "Incomplete Android signing identity in $signing_root; restore both files from backup or remove both to rotate intentionally." >&2
    exit 2
  fi

  umask 077
  signing_password="$(openssl rand -hex 32)"
  printf '%s\n%s\n' "$signing_password" "$signing_password" | keytool -genkeypair \
    -noprompt \
    -storetype PKCS12 \
    -keystore "$keystore_file" \
    -alias "$key_alias" \
    -keyalg RSA \
    -keysize 4096 \
    -validity 10000 \
    -dname "CN=Herdr Mobile, OU=Mobile, O=Herdr"
  printf 'HERDR_ANDROID_KEYSTORE_PASSWORD=%s\nHERDR_ANDROID_KEY_PASSWORD=%s\n' \
    "$signing_password" "$signing_password" >"$credentials_file"
fi

keystore_password=""
key_password=""
while IFS='=' read -r key value; do
  case "$key" in
    HERDR_ANDROID_KEYSTORE_PASSWORD) keystore_password="$value" ;;
    HERDR_ANDROID_KEY_PASSWORD) key_password="$value" ;;
  esac
done <"$credentials_file"

if [[ -z "$keystore_password" || -z "$key_password" ]]; then
  echo "Android signing credentials are malformed: $credentials_file" >&2
  exit 2
fi

export HERDR_ANDROID_KEYSTORE_FILE="$keystore_file"
export HERDR_ANDROID_KEYSTORE_PASSWORD="$keystore_password"
export HERDR_ANDROID_KEY_ALIAS="$key_alias"
export HERDR_ANDROID_KEY_PASSWORD="$key_password"
export EXPO_PUBLIC_HERDR_DEMO=0
export EXPO_PUBLIC_SHOWCASE=0

# The relay is distributed independently. Embed its public HTTPS URL explicitly
# when desired; otherwise the app opens its connection setup on first launch.
if [[ -n "${EXPO_PUBLIC_HERDR_URL:-}" ]]; then
  echo "Using configured Herdr relay: $EXPO_PUBLIC_HERDR_URL"
else
  echo "No Herdr relay URL configured; the release will show connection setup."
fi

EXPO_NO_GIT_STATUS=1 NODE_ENV=production pnpm exec expo prebuild --clean --platform android

cd android
NODE_ENV=production APP_VARIANT=production ./gradlew \
  assembleRelease \
  -PreactNativeArchitectures=arm64-v8a

echo "Android release APK: $repo_root/android/app/build/outputs/apk/release/app-release.apk"
