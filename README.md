# Herdr Mobile

Herdr Mobile is a native iOS and Android control surface for durable Herdr sessions. It connects to
the separately deployed Herdr Mobile Relay, displays live terminal panes, and lets an authorized
user navigate and operate Herdr from a phone or tablet.

The application never owns agent processes. Herdr and the relay run on the host; the mobile client
can disconnect, suspend, or be closed without terminating work.

## Features

- Spaces and linked worktrees grouped in a native navigator.
- Agent-focused view sorted by attention state.
- Live ANSI terminal rendering and interactive terminal input.
- Device-sized terminal takeover, resize, and scroll commands.
- Space, worktree, and shell-tab creation.
- Tab renaming and worktree removal.
- Multi-session selection.
- Optional read-only device authorization enforced by the relay.
- Secure persistence of relay connection settings.
- Responsive split layout for tablets and compact navigation for phones.
- iOS and Android native modules for terminal rendering and platform controls.

## System architecture

```text
Herdr Mobile
     |
     | HTTPS REST + WebSocket
     v
Herdr Mobile Relay on the private tailnet
     |
     | Unix-socket RPC
     v
Herdr server and durable terminal sessions
```

The companion relay is published separately as `herdr-plugin-mobile-relay`. Install and configure
that repository on the machine running Herdr before connecting this app.

## Requirements

### Development host

- Node.js 24.18.0, matching [.node-version](.node-version).
- pnpm.
- Xcode and CocoaPods for iOS development.
- Android Studio, Android SDK, JDK, and `adb` for Android development.
- macOS for iOS builds.

This project uses native modules and therefore does not run in Expo Go. Use an Expo development
client or a native release build.

### Herdr host

- A running Herdr server.
- The Herdr Mobile Relay plugin.
- A private network path from the device to the relay, normally Tailscale.

## Install dependencies

```bash
pnpm install
```

Optional formatting and native lint tools are listed in [Brewfile](Brewfile):

```bash
brew bundle
```

## Configure a relay

Copy the example environment file for build-time defaults:

```bash
cp .env.example .env.local
```

Set the relay URL printed by the host plugin’s `url` action:

```dotenv
EXPO_PUBLIC_HERDR_URL=https://your-machine.your-tailnet.ts.net:8787
EXPO_PUBLIC_HERDR_DEMO=0
```

The URL is only a default. Users can enter or replace it from the connection sheet, and the app
stores the resulting connection in platform secure storage. A named Herdr session may also be
selected.

Remote relay URLs must use HTTPS. Plain HTTP is accepted only for loopback development.

## Development

Start Metro for a native development client:

```bash
pnpm dev:client
```

Generate and run the Android native project:

```bash
pnpm android
```

Generate and run the iOS native project:

```bash
pnpm ios
```

The generated `/android` and `/ios` directories are disposable and ignored by Git. Native behavior
is defined by `app.config.ts`, config plugins, and the checked-in modules.

### Preview data

Use deterministic local data when a Herdr host is unavailable:

```bash
EXPO_PUBLIC_HERDR_DEMO=1 pnpm dev:client
```

For repeatable screenshots without development overlays:

```bash
pnpm showcase
```

Preview mode simulates mutations in memory and never contacts or changes a real Herdr session.

## Android release builds

Build a standalone ARM64 release APK with its JavaScript bundle embedded:

```bash
EXPO_PUBLIC_HERDR_URL=https://your-machine.your-tailnet.ts.net:8787 \
  pnpm android:release
```

Omit `EXPO_PUBLIC_HERDR_URL` to produce a generic build that opens connection setup on first launch.

The APK is written to:

```text
android/app/build/outputs/apk/release/app-release.apk
```

The first release build creates a private signing identity in:

```text
${XDG_CONFIG_HOME:-$HOME/.config}/herdr-mobile/android-signing
```

Back up both files in that directory together. Android will reject upgrades signed with a different
identity. Set `HERDR_ANDROID_SIGNING_DIR` to use another protected location.

### Install on an Android device

Enable USB or wireless debugging, then provide an explicit adb serial or `host:port`:

```bash
HERDR_ANDROID_ADB_SERIAL=adb-serial-or-host:port pnpm android:install
```

The installer uses `agent-device` to install and relaunch `dev.herdr.mobile`. It never selects an
arbitrary attached device. Customize the reusable automation session name when desired:

```bash
HERDR_ANDROID_ADB_SERIAL=adb-serial \
HERDR_ANDROID_DEVICE_SESSION=my-device \
  pnpm android:install
```

## iOS release builds

Generate and run a release configuration locally:

```bash
pnpm ios:release
```

The checked-in app configuration uses bundle identifier `dev.herdr.mobile` and an iOS deployment
target of 18.0. Forks that distribute their own signed build must change the bundle identifier and
configure an appropriate Apple development team, App Store record, and provisioning setup.

No App Store Connect or EAS project identifiers are committed.

## Verification

Run the complete standalone mobile verification suite:

```bash
pnpm verify
```

This runs:

```bash
pnpm typecheck
pnpm test
```

Resolve the public Expo configuration without generating native projects:

```bash
pnpm config -- --type public
```

For a release-level Android check, run `pnpm android:release` after the test suite.

## Repository layout

```text
assets/                  App icons, brand assets, and widget assets
modules/                 Native terminal, markdown, review, and platform-control modules
packages/                Shared contracts, client runtime, and utilities
patches/                 Pinned dependency compatibility patches
plugins/                 Expo config plugins
scripts/                 Release, install, configuration, and asset tooling
src/features/herdr/      Herdr-native application UI
src/hooks/               Relay connection and live terminal state
src/lib/                 Relay transport, domain model, storage, and helpers
app.config.ts            Expo application and platform configuration
pnpm-workspace.yaml      Workspace catalog and dependency policy
```

The project began from the open-source T3 Code mobile foundation and retains supporting modules
used by the Herdr-native screen. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for provenance.

## Connection behavior

The mobile transport consumes the relay’s bounded REST/WebSocket contract:

- Snapshot reads provide spaces, tabs, panes, sessions, and authorization state.
- REST mutations create and update structural Herdr resources.
- A session-scoped WebSocket announces structural changes.
- The selected pane receives full or incremental terminal frames.
- Resize and scroll messages are sent back through the live terminal controller.
- Bounded REST pane reads recover startup and reconnect state.

The UI treats the relay snapshot as authoritative. Optimistic state makes newly created spaces and
tabs immediately navigable while a subsequent refresh reconciles with Herdr.

## Security and privacy

- Use a tailnet-only relay; never expose write access through a public Funnel.
- Keep trusted-user validation enabled on the relay.
- Treat relay write authorization as remote shell authorization.
- Connection settings are stored with the platform secure-storage implementation.
- Release signing credentials live outside this repository.
- No personal hostname, tailnet name, IP address, user directory, token, or signing credential is
  required or committed.
- Demo mode is explicit and does not silently replace a failed live connection.

## Branding and identifiers

The default application name is `Herdr`, with Android package and iOS bundle identifier
`dev.herdr.mobile`. Brand source assets live under `assets/prod`.

If publishing an independent fork, review at least:

- `name`, `slug`, `scheme`, and platform identifiers in `app.config.ts`;
- application icons and splash assets;
- Android signing identity location;
- Apple signing and store metadata;
- default relay configuration and privacy disclosures.

## Troubleshooting

### The app opens connection setup

Enter the HTTPS URL printed by:

```bash
herdr plugin action invoke url --plugin herdr.control
```

Verify the device is connected to the same tailnet.

### The relay is reachable but shows read-only

The relay’s optional device-authorization policy does not allow this device to write. Update the
relay allowlist or continue in read-only mode.

### Live output pauses

The client automatically reconnects its WebSocket and falls back to bounded snapshot/pane reads.
Check relay status and confirm the Herdr server is still running.

### Android cannot find the device

Run `adb devices`, reconnect wireless debugging if needed, and pass the exact listed serial through
`HERDR_ANDROID_ADB_SERIAL`.

### Expo Go reports missing native modules

Expo Go is unsupported. Build an Expo development client with `pnpm android` or `pnpm ios`.

### A release build will not upgrade the installed Android app

The signing identity differs from the one used for the installed build. Restore the original
signing directory or uninstall the existing application before installing a differently signed fork.

## License

MIT. The root [LICENSE](LICENSE) covers the T3 Code-derived mobile foundation. Vendored and adapted
components retain their own notices and licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
