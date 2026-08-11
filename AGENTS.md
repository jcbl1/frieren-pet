# AGENTS.md

Tauri 2 + Vue 3 desktop pet. Architecture mirrors BongoCat (`ref/BongoCat/`, gitignored — local read-only reference).

## Commands

```bash
pnpm install
pnpm tauri dev          # runs `pnpm dev` via beforeDevCommand
pnpm dev                # Vite only — no Tauri APIs / window
pnpm typecheck          # vue-tsc --noEmit (no lint / no tests)
pnpm build              # frontend → dist/
pnpm tauri build        # native bundle (run on target OS)
cargo check -p frieren-pet   # after Rust edits; bare `cargo check` may pull macOS-only deps on Linux
```

- Package manager is **pnpm** (`beforeDevCommand`/`beforeBuildCommand` call it). No test suite / ESLint / Prettier.
- Vite: port **1420**, `strictPort: true`, ignores `src-tauri/**`.

## Layout

| Path | Role |
|------|------|
| `src/` | Vue frontend (`@/` → `src/`) |
| `src/pages/main/index.vue` | Pet window: drag, intents → `invoke`, scale |
| `src/pages/preference/index.vue` | Settings: pet cards / import-delete / window / about |
| `src/composables/usePet.ts` | State machine + pet reload + window resize/position |
| `src/services/petConfig.ts` | Load/validate `pet.json`; preset via manifest; user via `appDataDir/pets` |
| `src/services/petCatalog.ts` | Catalog list + `importPet`/`deletePet` wrappers |
| `src/renderers/` + `src/components/PetViewport.vue` | Renderer interface + `gif` backend |
| `src/stores/pet.ts` | Pinia store, **persisted** via `@tauri-store/pinia` |
| `src/types/pet.ts` | pet.json v1 types |
| `src-tauri/assets/pets/<id>/` | `pet.json` + media (asset protocol) |
| `src-tauri/assets/pets/manifest.json` | `presets` built-in id list (runtime) |
| `src-tauri/src/lib.rs` | Entry, `import_pet`/`delete_pet`, single-instance → settings, close→hide |
| `src-tauri/src/utils/pet_import.rs` | Import validation/copy; delete user pets |
| `src-tauri/src/setup/` | Tray + platform setup |
| `vendor/tauri-nspanel/` | macOS-only path dep (do not fetch) |
| `ref/` | Upstream mirror — **never commit** |

Cargo workspace root is this directory; only member is `src-tauri`.

## Constraints / traps (do not regress)

### Pet assets & state

- Built-in ids come from `assets/pets/manifest.json`, **not** `readDir` of the bundle. User pets are scanned from `{appDataDir}/pets/*`.
- **`resourceDir` must NOT be stored in `pet.json`** — loaders inject it at runtime (presets: `resolveResource('assets/pets/<id>')`; users: absolute `appDataDir/pets/<id>`).
- UI sends **intents** only: click / doubleClick / mouseEnter / mouseLeave / dragStart / dragEnd / rightClick / idle, plus load/switch (`start()` / `reloadPet()` → `setState(defaultState)`). Intents map via `capabilities` → per-pet states; missing cap/state is a **silent no-op**.
- `capabilities` values: string `"state"` or `{ state, cooldownMs?, afterMs? }` (`afterMs` only for `idle`, fallback 60s). Validation (TS `petConfig.ts` + Rust `pet_import.rs`) requires target state ∈ `states`.
- `currentPetId` lives in the Pinia store (default `"frieren"`); **main** watches it → `reloadPet()` (clear cache → load → default state → resize → wake). Preference only writes the id.
- Render path: `PetViewport` + `createRenderer(format)`. Only `gif` implemented; extend `PetFormat` + `createRenderer` for new backends.
- Import/delete are Rust commands: validate id/format/states/media/capabilities, reject preset id clash, copy into app data. Frontend confirms overwrite of an existing user id first.
- Plugins `tauri-plugin-fs` + `tauri-plugin-dialog`; capabilities need `fs:default` + `dialog:default`.

### Persistence / settings

- Store persisted via `@tauri-store/pinia` (`saveOnChange`) + `tauri-plugin-pinia`, auto-synced across windows. **Every persisted field MUST be in the initial `state()`** (use `null` for optional) — a key assigned later never enters `$state`, so it is never saved. Catalog lists are **not** persisted.
- Both windows call `petStore.$tauri.start()` in `App.vue` `onMounted` (guard with `__TAURI_INTERNALS__` for `pnpm dev`); main re-awaits it before the first `resizeWindow()`.
- Window side-effects run only in **main**: `alwaysOnTop`/`passThrough` watchers, `scale` resize, `currentPetId` reload, position capture (poll `outerPosition`/`outerSize` + save on close-requested; macOS NSPanel has **no `onMoved`**). Do NOT run these in the preference window.
- `resizeWindow()`: coalesced single-flight; size from current pet `width`/`height`; keep the geometric **center** in JS module state; every resize pins `setPosition(center − target/2)`; restore saved `x/y` once, guarded by an on-screen check. Needs `core:window:allow-outer-position` / `allow-outer-size`.

### Window / input

- Drag uses **`appWindow.startDragging()`** after a move threshold — not custom `setPosition`.
- Idle timer is **paused while dragging**: `setDragActive(true)` at drag threshold (clears timer), `false` on mouseup/dragEnd; `wake()` clears the flag so a swallowed mouseup (macOS) recovers on the next click/enter.
- Keep `mousedown` `preventDefault` and global `user-select: none` to suppress selection chrome.
- Window labels `"main"` / `"preference"`; macOS NSPanel conversion applies **only** to `main`.
- Close → hide (tray stays alive); tray init failure must not abort startup. Shift + right-drag scales via `petStore.scale` (20–150).

## Platform notes

- **macOS**: main window converted to NSPanel (`setup/macos.rs`, `cfg(target_os = "macos")` only; dep `vendor/tauri-nspanel/`). `macOSPrivateApi: true` required for transparency.
- **No cross-compile**: build each OS on itself.
- **Linux**: transparent/always-on-top needs an X11 compositor. Headless: `xvfb-run -a pnpm tauri dev`; if still blank set `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1`.

## Dual-host shared tree (macOS host + Linux container)

- `package.json` → `pnpm.supportedArchitectures` must list darwin/linux/win32 (pnpm 9 ignores `.npmrc`).
- Rust `target/` is OS-specific; use a separate `CARGO_TARGET_DIR` when hosts share the tree.

## Style / workflow

- Do not edit this file (AGENTS.md) without asking the user first.
- Do not commit unless the user asks.
- Match existing patterns over BongoCat wholesale copies; keep this app minimal.
- Do not add comments unless asked.
- After TS/Vue edits: `pnpm typecheck`. After Rust edits: `cargo check -p frieren-pet`.
