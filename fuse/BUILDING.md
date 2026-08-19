# Building FUSE

The game itself is one self-contained file: `prototype/index.html`. Everything
below is only about wrapping it for Android.

## Just play it

Open `prototype/index.html` in any browser — no build, no server, no
dependencies. On a phone, serve the folder over HTTP and use **Add to Home
Screen**: the manifest declares `display: standalone` and `orientation:
portrait`, so it launches full-screen with its own icon and no browser chrome,
and the service worker makes it work with the radio off.

## Android APK, on your own machine

Requires the Android SDK and **JDK 17**. Not 21 — this project is on Gradle
8.2.1 / AGP 8.2.1, and Gradle 8.2 refuses to run on JDK 21. If you hit
`Unsupported class file major version`, that is what it is.

```bash
cd fuse
npm install
npm run android:apk
```

The APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`.
`npm run android:open` opens the project in Android Studio instead.

After editing anything under `prototype/`, run `npm run android:sync` to copy
the web assets into the native project — the Android build does not read
`prototype/` directly, it reads the copy under
`android/app/src/main/assets/public/`.

## Android APK, without a local toolchain

Push to GitHub and the `FUSE Android APK` workflow
(`.github/workflows/fuse-android.yml`) builds a debug APK on every change under
`fuse/`. Download it from the run's **Artifacts** section — that link works from
a phone browser, so you can install straight from it. You can also trigger it by
hand from the Actions tab (`workflow_dispatch`).

## What is generated vs. committed

`android/` is committed, which is the normal Capacitor convention and lets CI
build without a scaffolding step. These are regenerated and stay ignored:

- `android/app/src/main/assets/public/` — copied from `prototype/` by `cap sync`
- `android/app/build/`, `android/.gradle/`, `android/local.properties`
- `node_modules/`

To rebuild the native project from scratch: `rm -rf android && npx cap add
android`. Note this discards the two hand-edits described below.

## Hand-edits to the generated Android project

Two changes were made to the scaffolding that `cap add android` would not
produce, and that a regeneration would wipe:

1. **Portrait lock** — `android:screenOrientation="portrait"` on the activity in
   `app/src/main/AndroidManifest.xml`. The layout adapts to landscape rather
   than breaking, but the board gets small; portrait is the intended shape.
2. **Adaptive icon** — `res/values/ic_launcher_background.xml` is set to the
   game's ground colour `#0B0E14` instead of the default white, and the
   `ic_launcher_foreground.png` mipmaps are transparent with the mark held
   inside the centre 66% so the launcher's mask cannot crop the outer shockwave
   ring.

Icons are generated from `prototype/icon.svg` (legacy square) and
`prototype/icon-foreground.svg` (adaptive foreground).

## Signing

The build above is **debug-signed** — fine for sideloading onto your own device,
not distributable. A release build needs a keystore and a `signingConfigs` block
in `android/app/build.gradle`; that is not set up here.

## Verified vs. not

Verified in a real browser: gameplay, deep chains, danger state, game-over,
one-tap restart, reduced-motion, audio persistence, keyboard path, and layout at
390x844, 844x390, and 360x640 with no overflow in any of them. The service
worker registers and the manifest and icons serve correctly over HTTP.

**The APK builds.** CI compiled it on the first attempt — `BUILD SUCCESSFUL`,
108 Gradle tasks, JDK 17, a 3.4 MB debug APK published as a workflow artifact.
The workflow also unzips the APK and asserts the game payload is inside it,
because a Capacitor build will happily succeed with an empty WebView if
`cap sync` did not copy anything.

**Still not verified: the APK running on a device.** Nobody has installed it. The
portrait lock, the adaptive icon masking, the back-button guard, and audio in a
WebView are all correct in principle and none of them has been seen working on
real hardware. That is the next thing to check.
