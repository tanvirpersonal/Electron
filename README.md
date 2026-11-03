# Electron — Android 3D Asset Builder

Electron is an Android-first 3D asset builder powered by Three.js and Capacitor. The project targets Android phones and tablets; desktop installers and desktop runtime builds are not part of the project.

## Current Android features

- Landscape-first Android workspace
- Touch-friendly realtime 3D viewport with orbit, zoom and pan
- Scene hierarchy and object selection
- Add cube, sphere, cylinder, cone, torus, capsule, plane, circle, ring, icosphere, dodecahedron and octahedron
- Move, rotate and scale gizmos
- Numeric position, rotation and scale controls
- Uniform scaling and mirror scaling
- Import GLB, glTF and OBJ
- Export scene as binary GLB using Android share/download support
- Hide side panels and immersive fullscreen viewport

## Requirements

- Node.js 22
- Java 21
- Android SDK / Android Studio (for local builds)

## Run the web layer locally

```bash
npm install
npm run dev
```

## Build Android APK

```bash
npm install
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

## GitHub Actions

Every push to `main` and manual workflow dispatch builds a debug APK. Download the `Electron-Android-APK` artifact from the workflow run. The artifact contains `Electron.apk`.

## Project direction

Android is the only target platform. Upcoming work should prioritize touch interaction, mobile 3D manipulation, materials, textures, project workflows and performance on Android devices.
