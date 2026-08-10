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
```

- Package manager is **pnpm** (`tauri.conf.json` `beforeDevCommand` / `beforeBuildCommand` call `pnpm`).
- No test suite, no ESLint/Prettier scripts.
- Vite: port **1420**, `strictPort: true`, ignores `src-tauri/**`.

## Layout

| Path | Role |
|------|------|
| `src/` | Vue frontend (`@/` → `src/`) |
| `src/pages/main/index.vue` | Pet window UI: drag, click, scale |
| `src/pages/preference/index.vue` | Settings window: scale/opacity/alwaysOnTop/passThrough/about |
| `src/router/index.ts` | Hash router: `#/` (main) + `#/preference` (settings) |
| `src/stores/pet.ts` | Pinia store, **persisted** via `@tauri-store/pinia` (`$tauri.start()` + `saveOnChange`) |
| `src/composables/usePet.ts` | State machine + asset resolve + window resize |
| `src/assets/pets/<id>/pet.json` | **Compiled into** frontend bundle (`import`) |
| `src-tauri/assets/pets/<id>/` | GIF/PNG **runtime** resources (`resolveResource` + asset protocol) |
| `src-tauri/src/lib.rs` | App entry, single-instance (2nd launch → settings), close→hide |
| `src-tauri/src/setup/` | Tray + platform setup (`macos.rs` / `common.rs`) |
| `vendor/tauri-nspanel/` | macOS-only path dep (do not fetch from GitHub) |
| `ref/` | Upstream mirror — **never commit** |

Cargo workspace root is this directory; only member is `src-tauri`.

## Asset / state coupling (easy to break)

- GIFs live under `src-tauri/assets/…` and are listed in `bundle.resources`.
- `pet.json` lives under `src/assets/…` and is **imported at build time** — changing it requires a frontend rebuild; it is not loaded at runtime from disk.
- `resourceDir` in pet.json is relative to Tauri resources (e.g. `assets/pets/frieren`), not the Vue `src/` tree.
- UI hardcodes state names: `setState('sleep')` / `setState('click')` in `index.vue`; idle timer also targets `'sleep'` in `usePet.ts`. Renaming states in JSON without updating those call sites breaks typecheck or silently no-ops.
- Current pet uses only `sleep.gif` (`defaultState: "sleep"`). `idle.gif` / `fallback.png` are unused leftovers.

## Persistence / settings

- Config lives in `src/stores/pet.ts` (Pinia setup store: `scale` / `alwaysOnTop` / `opacity` / `passThrough`). Persisted with `@tauri-store/pinia` (`saveOnChange`) + `tauri-plugin-pinia` (Rust), auto-synced across windows.
- Both windows call `petStore.$tauri.start()` in `App.vue` `onMounted` (guarded by `__TAURI_INTERNALS__` for `pnpm dev`).
- Window side-effects only run on **main**: `usePet()` registers `alwaysOnTop`/`passThrough` watchers + `scale` resize. Do NOT call these in the preference window (separate bundle entry via hash route).
- Tray "设置" shows the `preference` window; single-instance second launch also shows it.
- `src/pages/preference/index.vue` uses lightweight native CSS — no component library. `main.css` opts the preference body out of transparent/no-select defaults via `body.preference`.

## Window / input (do not regress)

- Drag uses **`appWindow.startDragging()`** after a small move threshold — not custom `setPosition`. Custom drag + `@mouseleave` caused grip loss and blue selection chrome on macOS.
- Keep `mousedown` `preventDefault` and global `user-select: none` (see `main.css`) to suppress WKWebView blue rectangles.
- Window label is always `"main"`.
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
- After TS/Vue edits: `pnpm typecheck`. After Rust edits: `cargo check` in workspace (macOS-only code is cfg-gated and won’t compile on Linux).
