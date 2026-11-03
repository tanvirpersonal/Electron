# ELECTRON — Total Build Plan

A browser-based 3D asset studio. TypeScript + Three.js + Vite, deployable to GitHub Pages.
This document is the full implementation plan: architecture, file layout, feature design, plugin API, build phases, and the test checklist.

---

## 1. Goals and constraints

- Real, working functionality end to end — no mockups, no placeholder systems.
- Preserve working features when modifying; never swap a working system for a stub.
- Modular, maintainable TypeScript; errors handled gracefully (toasts, never silent failures).
- Builds with `vite build`; relative `base` so it works on GitHub Pages under any repo name.
- Idle scene must not burn GPU: render on demand only.
- New objects spawn at world origin (0, 0, 0) unless the user specifies a position.

### Design tokens

| Token | Value |
|---|---|
| Background | `#050505` |
| Secondary surface | `#0B0B0D` |
| Panels / cards | `#111114` |
| Primary text | `#F5F5F7` |
| Secondary text | `#A1A1AA` |
| Accent | subtle crimson (≈ `#C8264B`, used sparingly: selection, active tool, focus rings) |

Layout: top toolbar · left sidebar (Create / Assets) · center viewport · right column (Outliner above Inspector) · bottom status bar. On narrow screens the side panels become toggleable drawers.

---

## 2. Architecture

```
src/
  main.ts                 bootstrap: create Editor, Viewport, UI, load built-in plugins
  core/
    events.ts             tiny typed event emitter
    history.ts            command stack (undo/redo), command merging
    editor.ts             single source of truth: scene content, selection, materials library, settings
    viewport.ts           renderer, cameras, controls, gizmo, picking, helpers, render loop
    factory.ts            primitive + light creation (spawn at origin)
    plugins.ts            plugin registry + PluginAPI types
    disposal.ts           dispose geometries / materials / textures safely
  io/
    importers.ts          GLB/GLTF/OBJ(+MTL) + multi-file resolution via drop/pick
    exporters.ts          GLB/GLTF export of selection or whole scene, download helper
  ui/
    dom.ts                small DOM helpers (h(), number field, slider, toggle, color input)
    toolbar.ts            project/scene actions, tool modes, snap, undo/redo, view
    sidebar.ts            Create palette + Asset/material library
    outliner.ts           hierarchy tree, collections, visibility/lock, rename, drag-reparent
    inspector.ts          tabs: Object · Material · Light · Scene/Environment · plugin panels
    materialPreview.ts    small dedicated renderer for the material sphere preview
    statusbar.ts          cursor/selection coordinates, counts, FPS/memory info
    toast.ts              non-blocking error/info messages
  plugins/
    extraPrimitives.ts    torus, torus knot, capsule, icosahedron, ring, tetrahedron
    extraFormats.ts       STL/PLY/FBX import; OBJ/STL export
    materialPresets.ts    gold, chrome, glass, rubber, emissive neon, …
    measure.ts            dimensions panel + bounding-box viewport utility
  styles/
    theme.css             all styling, CSS variables for the tokens above
```

### Scene graph model

- `scene` contains: lights/helpers owned by the viewport (grid, axes, origin marker, gizmo, shadow-catcher ground) and one `content` group.
- **Only `content` is user data** and the only thing exported. Anything flagged `userData.isHelper` is stripped on export.
- **Collections** are `Group`s with `userData.collection = true`, nestable.
- **Selectable root**: clicking any mesh resolves upward to the ancestor whose parent is `content` or a collection (so imported models select as a whole).
- Lights carry a small pickable proxy mesh (flagged helper) so they can be clicked in the viewport.
- Directional/spot light `target` is a child of the light at local `(0,0,-1)`, so the light's rotation controls its direction.

### State and events

`Editor` owns state and emits events: `objectAdded`, `objectRemoved`, `objectChanged`, `selectionChanged`, `materialsChanged`, `settingsChanged`, `historyChanged`, `pluginsChanged`. UI panels subscribe and re-render; nothing reaches into another panel directly.

### Undo / redo

Command pattern: `{ label, do(), undo(), merge?() }`. Covers add, delete, duplicate, rename, reparent, visibility, lock, transform (gizmo and numeric), material property edits, material assignment, scene settings. Continuous inputs (sliders, drags) record the start value on first `input` and commit one command on `change`/`mouseUp`.

### Rendering and performance

- `requestRender()` sets a dirty flag; the loop renders only when dirty or when OrbitControls damping reports movement.
- Pixel ratio capped (2 desktop, 1.5 mobile).
- Shadow maps only where lights opt in; shadow camera bounds set sensibly.
- `disposal.ts` walks removed subtrees and disposes geometries, materials (when no longer referenced by the library or other objects) and textures; undo stack holds references so disposal is deferred until a command is dropped from history.
- Material preview uses one small separate renderer, drawn only on change.
- Large-scene safeguards: raycasting limited to visible, unlocked content; outliner list updates are batched per frame.

---

## 3. Feature design

### 3.1 Viewport
- OrbitControls: left-drag orbit, right-drag/middle pan, wheel zoom, damping.
- Grid, colored XYZ axes, origin indicator.
- Click select, Shift/Ctrl-click multi-select, box-less empty click deselects.
- Gizmos via `TransformControls`: Move (G/W), Rotate (R/E), Scale (S/R-alt per keymap), world/local space toggle.
- **Snapping**: grid snap for move, angle snap for rotate, step snap for scale, with editable step values.
- **Alignment** (multi-select): align min/center/max per axis by bounding box, move to origin, drop to ground.
- **Frame selected** (F), **reset camera** (Home), front/top/right view presets.
- Multi-selection transforms through a pivot object at the selection centroid; the delta matrix is applied to each member and decomposed back to local TRS.

### 3.2 Object management
- Primitives: cube, sphere, cylinder, cone, plane, torus (plugin), and more via plugins.
- Import: GLB, GLTF (with `.bin`/textures resolved from multi-file selection), OBJ (+ `.mtl`), plus STL/PLY/FBX via plugin. Drag-and-drop and file picker.
- Duplicate (clone with independent transform, shared material unless made unique), rename (double-click), delete, hide, lock.
- Collections: create, nest, drag objects in/out, collapse.
- Outliner: tree with per-row visibility eye and lock toggle, multi-select sync with viewport, inline rename.
- Locked objects are selectable in the outliner but not draggable in the viewport and their numeric fields are disabled.

### 3.3 Transform system
- Independent X/Y/Z position fields; rotation in degrees (Euler XYZ); scale fields; all with accurate numeric input and arrow/drag-scrub.
- **Uniform scaling ON**
  - Keeps the current X:Y:Z ratio; editing any axis scales the others proportionally.
  - Single uniform control plus a **Quick Scale slider** (relative factor from drag start, committed as one undo step, slider recenters on release).
  - Viewport gizmo shows only the center handle.
- **Uniform scaling OFF**
  - Independent axes; gizmo shows separate X/Y/Z (and plane) handles.
- Mirror toggles (flip X/Y/Z) and negative-scale support (renderer winding handled by Three.js). Reset scale to `(1,1,1)`.
- **Gizmo workaround**: Three's `TransformControls` hides the center scale handle whenever any `showX/Y/Z` is false (the center handle's name contains all three letters). So the plan is to leave `showX/Y/Z` on and patch the gizmo helper's `updateMatrixWorld` to hide handles by name afterward — in both the visible gizmo and the picker group — keeping only `XYZ` in uniform mode and hiding `XYZ` in non-uniform mode.

### 3.4 Materials
- Material library (project-level) plus per-mesh editing via `MeshStandardMaterial`.
- Controls: base color, metalness, roughness, opacity (auto-toggles `transparent`), emissive color + intensity, wireframe, double-sided.
- Texture slots (base color map, others as time allows) loaded from file via object URLs, with remove.
- Live material preview sphere in the inspector.
- Assign a library material to the selection; "Make unique" clones the material for the selected object.
- Material extensions (plugins) add presets/appliers.

### 3.5 Lighting and environment
- Directional, point, spot, ambient lights: color, intensity, shadow toggle; spot angle/penumbra; point/spot distance and decay.
- Default scene: ambient + one directional "Sun" with soft shadows; new lights from the Create palette spawn at origin (directional/spot pre-rotated to aim downward).
- Environment: procedural room environment by default, HDR (`.hdr`) loading, environment intensity, background mode (solid / environment), exposure/tone mapping.
- Optional shadow-catcher ground (helper, never exported).

### 3.6 Import / export
- Export selection or whole scene as GLB or glTF, preserving transforms and materials (selected objects are cloned with their world matrix baked so nested transforms survive).
- Helpers stripped before export; lights exported through `KHR_lights_punctual`.
- Download via Blob + anchor, with a sensible filename.
- Extra exporters (OBJ, STL) through the plugin API.
- Project save/load as JSON (scene via glTF + editor settings) for round-tripping.

### 3.7 UI/UX
- Premium dark theme from the tokens above, subtle borders, 150–200 ms transitions, consistent spacing scale.
- Keyboard shortcuts: tool modes, F frame, Delete, Ctrl+D duplicate, Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y), H hide, Esc deselect.
- Status bar: selection name/count, selected position, cursor world coordinates on the ground plane, object/triangle counts, FPS.
- Toasts for errors (failed import, unsupported file, export failure) instead of console-only failures.
- Responsive: drawers on small screens, touch-friendly hit targets, pointer events throughout.

---

## 4. Plugin architecture

```ts
interface ElectronPlugin {
  id: string; name: string; version: string;
  activate(api: PluginAPI): void;
  deactivate?(): void;
}

interface PluginAPI {
  editor: Editor;
  registerObjectType(t: { id; label; category?; create(opts): Object3D }): Disposer;
  registerTool(t: { id; label; icon?; shortcut?; onActivate?; onDeactivate?; onPointer?(e, ctx) }): Disposer;
  registerInspectorPanel(p: { id; title; order?; appliesTo(sel): boolean; render(el, sel, editor): void | (() => void) }): Disposer;
  registerImporter(i: { id; label; extensions: string[]; load(file, ctx): Promise<Object3D> }): Disposer;
  registerExporter(x: { id; label; extension: string; export(objects, editor): Promise<Blob> | Blob }): Disposer;
  registerMaterialExtension(m: { id; label; presets?: MaterialPreset[]; apply?(mat, editor): void }): Disposer;
  registerViewportUtility(u: { id; label; create(ctx): { setEnabled(on): void; update?(): void; dispose(): void } }): Disposer;
}
```

- Every `register*` returns a disposer; the registry tracks them per plugin so `deactivate` cleanly unregisters everything.
- Registry emits `pluginsChanged`; the Create palette, import/export menus, inspector tabs and toolbar rebuild from the registries — so plugins never edit core UI code.
- Plugin errors are caught and surfaced as toasts; a failing plugin never takes the editor down.
- **Built-in plugins double as living examples and cover all six extension points:**
  - `extra-primitives` → object types
  - `measure` → custom tool + inspector panel + viewport utility (bounding box)
  - `extra-formats` → import and export extensions
  - `material-presets` → material extension

---

## 5. Build phases

| Phase | Scope | Done when |
|---|---|---|
| 1. Scaffold | Vite, TS, GitHub Pages workflow, theme CSS, app shell layout | `npm run build` passes; empty shell renders (**done: scaffold pushed**) |
| 2. Core | Editor state, events, history, viewport, on-demand render loop, grid/axes/origin, picking, orbit camera | Can orbit, click-select, and undo a trivial change |
| 3. Objects | Factory, primitives at origin, outliner, collections, duplicate/rename/delete/hide/lock | Full object lifecycle works with undo/redo |
| 4. Transforms | Gizmos, snapping, numeric inspector, uniform/non-uniform scale, quick scale, mirror, reset, multi-select pivot, align | Gizmo and numeric input stay in sync; undo is exact |
| 5. Materials | Library, editor, textures, preview, assign/make-unique | Edits show live in viewport and preview |
| 6. Lighting | Light types, inspector, shadows, environment/HDR, background | Shadows and env lighting respond in real time |
| 7. I/O | Importers (multi-file), exporters, download, project save/load | Export → re-import round-trips transforms and materials |
| 8. Plugins | Registry, API, four built-in plugins | Each of the six hooks exercised by a built-in plugin |
| 9. Hardening | Disposal audit, error handling, mobile/touch pass, perf with large scenes, shortcuts, README | No leaks across create/delete cycles; builds clean |
| 10. Deploy | GitHub Pages workflow verified, README with usage and plugin guide | Live site loads and works from the Pages URL |

Each phase ends with a typecheck, a Vite build, and a commit so history stays reviewable.

---

## 6. Test checklist

**Viewport**: orbit/pan/zoom; selection and multi-selection; frame selected; reset camera; view presets; grid/axes visible; no rendering while idle (verify via render counter).

**Objects**: every primitive spawns at exactly (0,0,0); duplicate/rename/delete/hide/lock; collections nest and reparent; outliner stays in sync with viewport selection.

**Transforms**: numeric position/rotation/scale accuracy; uniform ON preserves ratio from non-1:1:1 start (e.g. 1:2:3); Quick Scale slider is one undo step; uniform OFF allows stretch; mirror and negative scale render correctly; reset scale; gizmo handle visibility matches uniform mode; snapping honors step values; undo/redo restores exact values including after multi-select transforms.

**Materials**: every property updates live; opacity toggles transparency; texture load/remove; assign to selection; make unique; preview matches viewport.

**Lighting**: each light type; color/intensity; shadows on/off; HDR load; background mode; exposure.

**I/O**: export selection and scene as GLB and glTF; re-import and compare transforms/materials; multi-file glTF with `.bin` + textures; OBJ with MTL; bad file shows a toast, app keeps running.

**Plugins**: each built-in registers and unregisters cleanly; a throwing plugin does not break the editor.

**Reliability**: create/delete 500 objects and confirm geometry/material counts return to baseline (`renderer.info.memory`); resize and DPR changes; touch input on a mobile viewport.

**Build/deploy**: `npm run build` succeeds with zero TS errors; `vite preview` works from a sub-path; GitHub Pages workflow deploys.

---

## 7. Risks and decisions

- **Center scale handle hidden by `showX/Y/Z`** — handled by patching handle visibility by name (see 3.3).
- **Multi-select scaling with rotated members** can introduce shear when decomposing; accepted and documented, as in most editors.
- **Directional light at origin** would clip shadows with a default near plane; shadow camera near is set negative with generous bounds.
- **Shared materials**: editing a library material affects every user of it by design; "Make unique" is the escape hatch.
- **Bundle size**: Three.js plus loaders is large; loaders for extra formats are dynamically imported inside plugins so the core bundle stays lean.
- **Texture blob URLs** must be revoked on dispose to avoid leaks.

---

## 8. Definition of done

A user can open the deployed page, create and import assets, transform them precisely (including proportional and non-proportional scaling), style them with materials and lights, organize them in collections, undo/redo any step, extend the app through plugins, and export the result as GLB/glTF — with the app staying responsive, idle-cheap, and free of leaks.
