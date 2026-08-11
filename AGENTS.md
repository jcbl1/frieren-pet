# AGENTS.md

Tauri 2 + Vue 3 desktop pet. Architecture mirrors BongoCat (`ref/BongoCat/`, gitignored — local read-only reference only).

## Commands

```bash
pnpm install
pnpm tauri dev          # full app (runs `pnpm dev` via beforeDevCommand)
pnpm dev                # Vite only — no Tauri APIs / window
pnpm typecheck          # vue-tsc --noEmit (no lint / no tests)
pnpm build              # frontend → dist/
pnpm tauri build        # native bundle (must run on target OS)
cargo check -p frieren-pet   # after Rust edits (prefer -p; bare `cargo check` may pull macOS-only tauri-nspanel on Linux)
```

- Package manager is **pnpm** (`tauri.conf.json` `beforeDevCommand` / `beforeBuildCommand` call `pnpm`).
- No test suite, no ESLint/Prettier scripts.
- Vite: port **1420**, `strictPort: true`, ignores `src-tauri/**`.

## Layout

| Path | Role |
|------|------|
| `src/` | Vue frontend (`@/` → `src/`) |
| `src/pages/main/index.vue` | Pet window UI: drag, click → `invoke`, scale |
| `src/pages/preference/index.vue` | Settings: pet cards / import-delete / scale/opacity/alwaysOnTop/passThrough/about |
| `src/router/index.ts` | Hash router: `#/` (main) + `#/preference` (settings) |
| `src/stores/pet.ts` | Pinia store, **persisted** via `@tauri-store/pinia` (`$tauri.start()` + `saveOnChange`) |
| `src/composables/usePet.ts` | State machine + pet reload + window resize / position |
| `src/types/pet.ts` | `PetConfig` / `PetStateConfig` / `PetCapabilities` / `PetFormat` (v1) |
| `src/services/petConfig.ts` | Load/validate `pet.json`; preset via manifest; user via `appDataDir/pets` |
| `src/services/petCatalog.ts` | Catalog list + `importPet` / `deletePet` wrappers |
| `src/renderers/` | `PetRenderer` + `GifRenderer` + `createRenderer` |
| `src/components/PetViewport.vue` | Hosts active renderer |
| `src-tauri/assets/pets/<id>/` | `pet.json` + media (`resolveResource` + asset protocol) |
| `src-tauri/assets/pets/manifest.json` | `presets` built-in id list (runtime) |
| `src-tauri/src/lib.rs` | App entry, `import_pet`/`delete_pet`, single-instance → settings, close→hide |
| `src-tauri/src/utils/pet_import.rs` | Import validation + copy into app data; delete user pets |
| `src-tauri/src/setup/` | Tray + platform setup (`macos.rs` / `common.rs`) |
| `vendor/tauri-nspanel/` | macOS-only path dep (do not fetch from GitHub) |
| `ref/` | Upstream mirror — **never commit** |

Cargo workspace root is this directory; only member is `src-tauri`.

## Multi-pet / asset coupling (easy to break)

- GIFs and `pet.json` live under `src-tauri/assets/…` and are listed in `bundle.resources`.
- `src-tauri/build.rs` emits `cargo:rerun-if-changed=assets`, so ANY add/change/remove under `src-tauri/assets/` triggers a cargo rebuild that re-copies resources into the dev resource dir (`target/<triple>/debug/assets`). Without it, newly added files under the `assets/pets/**/*` glob are silently never copied (tauri-build only watches files that existed at build time).
- Built-in ids come from `assets/pets/manifest.json` (do not rely on `readDir` of the bundle). User pets are scanned from `{appDataDir}/pets/*` via `plugin-fs` `readDir`.
- `pet.json` is loaded **at runtime** (`petConfig.ts` / asset-protocol `fetch`). Changing JSON does NOT need a frontend rebuild, but packaged apps need a Tauri rebuild/re-run for preset changes.
- **`resourceDir` is NOT stored in `pet.json`**. Loaders inject it: presets from `resolveResource('assets/pets/<id>')`, users from absolute `appDataDir/pets/<id>`. Never write `resourceDir` into a pet package.
- UI sends **intents** only: single click → `invoke('click')`, double-click → `invoke('doubleClick')`, mouse enter → `invoke('mouseEnter')`, mouse leave → `invoke('mouseLeave')`, drag threshold → `invoke('dragStart')` + `startDragging()`, drag mouseup → `invoke('dragEnd')`, right-click → `invoke('rightClick')` (with `preventDefault`; skipped while Shift held for scaling), idle timer → `invoke('idle')`, load/switch → `start()` / `reloadPet()` → `setState(defaultState)`. Intents map via `capabilities` in pet.json; missing capability/state is a silent no-op. State names are fully per-pet.
- `capabilities` values may be a plain string `"state"` **or** an object `{ state, cooldownMs?, afterMs? }`. `cooldownMs` debounces the same intent (Map in `usePet.ts`, cleared on `reloadPet`). `afterMs` applies only to the `idle` intent (fallback global 60s). Both TS (`petConfig.ts`) and Rust (`pet_import.rs`, untagged enum) validation resolve the target state and require it ∈ `states`.
- macOS native dragging swallows mouseup, so `dragEnd` may not fire there (same root cause as position-capture polling); `dragStart` fires before `startDragging()` and is reliable everywhere.
- `currentPetId` is in the Pinia store (default `"frieren"`). Main `usePet()` watches it and calls `reloadPet()` (clear config cache → load → default state → resize → wake). Preference only writes the id.
- Render path: `PetViewport` + `createRenderer(format)`. Only `gif` is implemented; extend `PetFormat` + `createRenderer` for new backends.
- Import/delete are Rust commands (`import_pet` / `delete_pet` in `utils/pet_import.rs`): validate id/format/states/media/capabilities, reject preset id clash, copy into app data. Frontend confirms overwrite of existing user id before invoke.
- Preset `fern` has no `click` capability (click is no-op) — useful when testing capability mapping.
- Plugins: `tauri-plugin-fs`, `tauri-plugin-dialog` (+ JS packages); capabilities need `fs:default` and `dialog:default`.

## Persistence / settings

- Config lives in `src/stores/pet.ts` (option store: `currentPetId` / `scale` / `alwaysOnTop` / `opacity` / `passThrough` / `x` / `y`). Persisted with `@tauri-store/pinia` (`saveOnChange`) + `tauri-plugin-pinia` (Rust), auto-synced across windows.
- **Every persisted field MUST be in the initial `state()`** (use `null` for optional). Assigning a new key on an option store only sets a local proxy property — it never enters `$state`, so `@tauri-store/pinia` never patches/saves it. Catalog lists are **not** persisted.
- Both windows call `petStore.$tauri.start()` in `App.vue` `onMounted` (guarded by `__TAURI_INTERNALS__` for `pnpm dev`); main page re-awaits it in its own `onMounted` before the first `resizeWindow()` so saved position/scale restore deterministically.
- Window side-effects only run on **main**: `usePet()` registers `alwaysOnTop`/`passThrough` watchers + `scale` resize + `currentPetId` reload + position capture (400ms poll of `outerPosition`/`outerSize` + save on close-requested; macOS NSPanel does NOT deliver `onMoved`, so do not rely on it). Do NOT call these in the preference window (separate bundle entry via hash route).
- `resizeWindow()` in `usePet.ts`: coalesced single-flight (concurrent calls are serialized, latest target wins). Size comes from the **current** pet's `width`/`height`. The geometric **center** is tracked in JS module state (`center`), updated only by restore/init or the poll of a settled frame (never read during a resize — `resizing` gate), and every resize pins `setPosition(center − target/2)` so macOS's async `setSize`/`setPosition` (GCD-dispatched) cannot accumulate drift. First run restores saved `x/y` once (guarded by `availableMonitors` on-screen check). Needs `core:window:allow-outer-position` / `allow-outer-size` in capabilities.
- Tray "设置" shows the `preference` window; single-instance second launch also shows it.
- `src/pages/preference/index.vue` uses lightweight native CSS — no component library. `main.css` opts the preference body out of transparent/no-select defaults via `body.preference`.

## Window / input (do not regress)

- Drag uses **`appWindow.startDragging()`** after a small move threshold — not custom `setPosition`. Custom drag + `@mouseleave` caused grip loss and blue selection chrome on macOS.
- Idle timer is **paused while dragging**: drag threshold calls `setDragActive(true)` (clears the timer), mouseup/dragEnd calls `setDragActive(false)`. `wake()` clears the flag too, so if macOS swallows mouseup the next click/enter resumes idle. The idle callback re-arms itself while `dragActive`, so a held drag never falls into idle regardless of `afterMs`.
- Keep `mousedown` `preventDefault` and global `user-select: none` (see `main.css`) to suppress WKWebView blue rectangles.
- Window labels: `"main"` (pet) and `"preference"` (settings). macOS NSPanel conversion applies **only** to `main`.
- Close is intercepted → hide; tray stays alive. Tray init failure must not abort startup.
- Shift + right-drag scales via `petStore.scale` (20–150).

## Platform notes

- **macOS**: `setup/macos.rs` converts main window to NSPanel (`is_floating_panel`, Dock level, nonactivating). Depends on `tauri-nspanel` only under `cfg(target_os = "macos")`. `macOSPrivateApi: true` required for transparency. Bundle icons currently lack `icon.icns` (generate with `pnpm tauri icon ./src-tauri/assets/logo.png` if packaging on Mac).
- **Non-macOS**: empty `common::setup`. Tray icon is `tray.png` (mac uses `tray-mac.png`).
- **No Tauri cross-compile**: build Windows on Windows, macOS on macOS, etc.
- **Linux**: transparent/always-on-top needs X11 compositor. Headless/container blank window: `xvfb-run -a pnpm tauri dev`; if still blank set `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`, `WEBKIT_DISABLE_COMPOSITING_MODE=1`, `WEBKIT_DISABLE_DMABUF_RENDERER=1`.

## Dual-host shared tree (macOS host + Linux container)

- `package.json` → `pnpm.supportedArchitectures` includes darwin/linux/win32 so one `node_modules` works across hosts. That field must stay in `package.json` (pnpm 9 ignores it in `.npmrc`).
- Rust `target/` is **not** portable across OS; use separate `CARGO_TARGET_DIR` if hosts share the tree frequently.

## Style / workflow

- Prefer matching existing patterns over BongoCat wholesale copies; when porting behavior, check `ref/BongoCat/` first but keep this app minimal.
- Do not commit `ref/`, `*.bak`, `node_modules/`, `dist/`, `target/`, or `src-tauri/gen/schemas`.
- Do not add comments unless asked.
- After TS/Vue edits: `pnpm typecheck`. After Rust edits: `cargo check -p frieren-pet` (macOS-only code is cfg-gated and won’t compile on Linux).
