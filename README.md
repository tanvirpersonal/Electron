# Electron — 3D Asset Builder

Electron is a desktop 3D asset builder powered by Electron, Three.js and Vite.

## Current features

- Realtime 3D viewport with orbit, zoom and pan
- Scene hierarchy, object selection, add, duplicate and delete
- Move, rotate and scale gizmos (W / E / R)
- Numeric position, rotation and scale controls
- Uniform scaling and mirror/negative-scale mode
- Import GLB, glTF and OBJ
- Export scene as binary GLB

## Requirements

- Node.js 22 LTS (or newer supported Node 22 release)
- npm

## Run from source

```bash
npm install
npm run dev
```

## Build locally

```bash
npm run build
npm run dist
```

Installers are written to the `release/` directory.

## Desktop installers

GitHub Actions builds the app for:
- Linux: AppImage and Debian package (.deb)
- Windows: x64 NSIS installer (.exe)
- macOS: DMG

To publish downloadable installers, create and push a version tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

The workflow builds all three platforms and attaches the installers to the GitHub Release. A manual run from the Actions tab also builds downloadable workflow artifacts.

## Current scope

This is an early desktop MVP. Advanced mesh editing, undo/redo, project save/load, material editing, texture painting and sculpting are not implemented yet.
