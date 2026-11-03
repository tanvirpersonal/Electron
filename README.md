# Electron — Android 3D Asset Builder

Electron is an Android-first 3D asset builder powered by Three.js and Capacitor. It targets Android phones and tablets; desktop installers and desktop runtime builds are not part of the project.

The app is designed around touch: a full-screen 3D viewport with floating controls, big tap targets, and panels that behave like native Android bottom sheets and drawers.

## The interface

| Area | What it does |
|---|---|
| **Viewport** | Fills the whole screen. Everything else floats above it. |
| **Top bar** | Home, brand, Undo / Redo (planned), Import, Export GLB, Immersive mode. |
| **Tool rail** (left) | Multi-select, Move, Rotate, Scale, Focus selected, Reset camera, Grid. |
| **Dock** (bottom) | Six tabs: **Add · Scene · Transform · Material · World · Roadmap**. |
| **Panel** | Opens from the dock. A right-hand drawer in landscape, a bottom sheet in portrait (swipe the handle down to close). |
| **Selection bar** | Appears when something is selected: name, Duplicate, Delete. Tap the name to open Transform. |
| **Home screen** | Back to the workspace or start a new scene. |

Layouts adapt to short landscape phones (compact chrome, two-column rail, drawer uses the full height), portrait phones (bottom sheet, camera shifts so the object stays visible above it) and tablets. Safe-area insets are respected, no web fonts are loaded, and all icons are inline SVG, so the UI renders the same on every device and works fully offline in the APK.

Items that are planned but not built yet appear in the UI with a **SOON** tag. Tapping one tells you it is planned and points to the Roadmap tab. They do nothing yet.

### Gestures

| Action | Gesture |
|---|---|
| Select object | Tap |
| Move object | Drag it |
| Orbit camera | Drag empty space |
| Zoom / pan | Pinch / two fingers |
| Duplicate or delete | Long-press an object |

Keyboard shortcuts (for emulators and Bluetooth keyboards): `W` / `E` / `R` move, rotate, scale · `F` immersive · `Delete` remove · `1`–`6` open a dock tab · `Esc` close the panel.

## Current features

- Landscape-first Android workspace, also usable in portrait
- Touch-friendly realtime 3D viewport: orbit, pinch zoom and pan
- 15 shapes: cube, sphere, cylinder, cone, torus, capsule, plane, circle, ring, icosphere, dodecahedron, octahedron, tetrahedron, torus knot, triangular prism
- Scene list with per-shape icons and object selection
- Move, rotate and scale gizmos
- Numeric position, rotation and scale fields
- Uniform scaling and mirror scaling
- Multi-select, touch drag and long-press Duplicate / Delete
- Material editing: base color, roughness, metalness, opacity
- Import GLB, glTF and OBJ
- Export the scene as binary GLB using Android share / download support
- Immersive fullscreen viewport
- Home screen with continue / new scene

## Roadmap

Legend: ✅ shipped · 🔜 next · 🕒 later · 💡 idea.
The same list is shown inside the app under the **Roadmap** tab.

### Shipped

- ✅ Touch viewport: orbit, pinch zoom, pan
- ✅ 15 primitive shapes
- ✅ Move / rotate / scale gizmos
- ✅ Numeric transform, uniform + mirror scale
- ✅ Multi-select, touch drag, long-press menu
- ✅ Material: color, roughness, metalness, opacity
- ✅ GLB / glTF / OBJ import, GLB export + share
- ✅ Immersive fullscreen, Android APK build

### Editing and workflow

- 🔜 Undo / redo history
- 🔜 Rename, hide and lock objects
- 🔜 Collections and parenting
- 🔜 Snapping: grid, angle, scale step
- 🕒 Align and distribute
- 🕒 Box select, select all, invert
- 🔜 Autosave and project save / load
- 🕒 Recent projects on the home screen

### Materials

- 🔜 Emissive color and intensity
- 🔜 Texture maps: color, normal, roughness, metal
- 🕒 Material library and presets
- 🕒 Material preview sphere
- 🕒 UV scale / offset, wireframe, double-sided

### Lighting and world

- 🔜 Directional, point, spot, ambient lights
- 🔜 Light color and intensity
- 🕒 Real-time shadows
- 🕒 HDR environment lighting
- 🕒 Background color and exposure

### Modeling

- 🕒 Editable shape parameters (segments, radius)
- 🕒 Pivot / origin tools
- 🕒 Mirror and array modifiers
- 💡 Boolean operations (CSG)
- 💡 3D text
- 💡 Vertex edit and sculpt

### Import and export

- 🕒 STL, PLY and FBX import
- 🕒 Multi-file glTF (.bin + textures)
- 🔜 Export selection only
- 🕒 OBJ, STL and glTF export

### Viewport and Android UX

- 🕒 Front / top / right views, orthographic
- 🕒 Shading modes: solid, wire, material
- 🕒 Stats: FPS and triangle count
- 🕒 Haptic feedback
- 🕒 Left-handed layout
- 🕒 Tablet and foldable layouts
- 💡 Stylus support
- 💡 Light theme
- 🕒 Bangla and English UI

### Performance and reliability

- 🔜 Render only when something changes
- 🔜 Dispose unused GPU resources (geometries, materials, textures)
- 🕒 Low-power mode
- 💡 Instancing / LOD for large scenes
- 🕒 Crash-safe autosave

### Platform

- 🕒 Plugin system: shapes, tools, panels, importers, exporters, materials
- 🕒 TypeScript migration, modular structure
- 🕒 Automated tests and CI checks
- 🕒 Signed release APK / AAB
- 💡 Offline PWA build

### Ideas

- 💡 AR preview (ARCore)
- 💡 Animation timeline and turntable
- 💡 Share links / cloud sync

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

Pushes to `main` and branch `1` also build the web layer and deploy it to GitHub Pages as a browser preview.

## Project structure

```
index.html      App shell: icon sprite, top bar, rail, panels, dock, home screen
style.css       Android-first UI styles (design tokens, responsive layouts)
src/main.js     Three.js scene, gizmos, selection, import / export, transform and material logic
src/ui.js       Interface chrome: dock tabs, drawer / bottom sheet, Roadmap and World panels
```

To add a roadmap item, edit the `ROADMAP` list in `src/ui.js` and the matching section above.

## Project direction

Android is the only target platform. Upcoming work should prioritize touch interaction, mobile 3D manipulation, materials, textures, project workflows and performance on Android devices.
