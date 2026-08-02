#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device_serial="${HERDR_ANDROID_ADB_SERIAL:-${1:-}}"
device_session="${HERDR_ANDROID_DEVICE_SESSION:-herdr-android}"
apk_path="$repo_root/android/app/build/outputs/apk/release/app-release.apk"

if [[ -z "$device_serial" ]]; then
  echo "Usage: HERDR_ANDROID_ADB_SERIAL=<host:port-or-serial> pnpm android:install" >&2
  exit 2
fi

if [[ ! -f "$apk_path" ]]; then
  echo "Release APK not found. Run pnpm android:release first." >&2
  exit 2
fi

if [[ "$device_serial" == *:* ]]; then
  adb connect "$device_serial" >/dev/null
fi

if [[ "$(adb -s "$device_serial" get-state 2>/dev/null || true)" != "device" ]]; then
  echo "Android device is not connected or authorized: $device_serial" >&2
  exit 3
fi

pnpm dlx agent-device@0.18.2 \
  install dev.herdr.mobile "$apk_path" \
  --platform android \
  --serial "$device_serial"

pnpm dlx agent-device@0.18.2 \
  open dev.herdr.mobile \
  --platform android \
  --serial "$device_serial" \
  --session "$device_session" \
  --relaunch
