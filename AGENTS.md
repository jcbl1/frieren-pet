# AGENTS.md

Tauri 2 + Vue 3 desktop pet. Architecture mirrors BongoCat (`ref/BongoCat/`, gitignored — local read-only reference). User-facing docs live in `docs/`; README is a landing page.

## Commands

```bash
nvm use 22                 # .nvmrc; Node 22, pnpm 9 (packageManager), Rust stable
corepack enable
pnpm install --frozen-lockfile
pnpm tauri dev          # runs `pnpm dev` via beforeDevCommand
pnpm dev                # Vite only — no Tauri APIs / window
pnpm typecheck          # vue-tsc --noEmit (no lint / no tests)
pnpm build              # frontend → dist/
pnpm tauri build        # native bundle (run on target OS)
cargo check -p frieren-pet   # after Rust edits; bare `cargo check` may pull macOS-only deps on Linux
pnpm sync:version vX.Y.Z     # writes version to package.json + tauri.conf.json + Cargo.toml (dirty-tree side effect)
SHOP_API_BASE=<url> pnpm prepare:env  # writes gitignored .env.production.local; exits 1 if var unset (mirrors CI secret)
```

- Package manager is **pnpm**. No test suite / ESLint / Prettier.
- Vite: port **1420**, `strictPort: true`, ignores `src-tauri/**`.
- Before expensive commands, inspect available CPU/memory and adjust Cargo parallelism.

## Layout

| Path | Role |
|------|------|
| `src/` | Vue frontend (`@/` → `src/`) |
| `src/pages/main/index.vue` | Pet window: drag, intents → `invoke`, scale |
| `src/pages/preference/` | Settings: `PetsTab` / `ShopTab` / `AppearanceTab` / `AboutTab` |
| `src/composables/usePet.ts` | State machine + pet reload + window resize/position |
| `src/services/` | `petConfig`/`petCatalog` (pets), `petShop` (shop, dev mock fallback), `notice`/`notification`/`updater` |
| `src/stores/pet.ts` | Pinia store, **persisted** via `@tauri-store/pinia` |
| `src/types/pet.ts` | pet.json v1 types |
| `src-tauri/assets/pets/manifest.json` | `presets` built-in id list (runtime; **not** `readDir`) |
| `src-tauri/src/lib.rs` | Entry. Commands: `import_pet`/`delete_pet`, `fetch_shop_catalog`, `install_pet_from_url`, `check_for_update`/`download_release_asset`, `fetch_notices`, `quit_app` |
| `src-tauri/src/utils/` | `pet_import.rs` (import/delete), `pet_download.rs` (shop), `updater.rs`, `notices.rs` |
| `src-tauri/src/setup/` | Tray + platform setup (macOS NSPanel) |
| `vendor/tauri-nspanel/` | macOS-only path dep (do not fetch) |
| `docs/` | `setup` / `pet-format` / `architecture` / `release` / `shop-api` |
| `ref/` | Upstream mirror — **never commit** |

Cargo workspace root is this directory; only member is `src-tauri`.

## Constraints / traps (do not regress)

### Pet assets & state

- Built-in ids come from `assets/pets/manifest.json`, **not** `readDir` of the bundle. User pets are scanned from `{appDataDir}/pets/*`.
- **`resourceDir` must NOT be stored in `pet.json`** — loaders inject it at runtime (presets: `resolveResource('assets/pets/<id>')`; users: absolute `appDataDir/pets/<id>`).
- UI sends **intents** only: click / doubleClick / mouseEnter / mouseLeave / dragStart / dragEnd / rightClick / idle, plus load/switch (`start()` / `reloadPet()` → `setState(defaultState)`). Intents map via `capabilities` → per-pet states; missing cap/state is a **silent no-op**.
- `capabilities` values: string `"state"` or `{ state, cooldownMs?, afterMs? }` (`afterMs` only for `idle`, fallback 60s). Validation (TS `petConfig.ts` + Rust `pet_import.rs`) requires target state ∈ `states`.
- `currentPetId` lives in the Pinia store (default `"frieren"`); **main** watches it → `reloadPet()` (clear cache → load → default state → resize → wake). Preference only writes the id.
- Import/delete, shop install (`install_pet_from_url`), and update asset download all route through the same `pet_import.rs` validation (id/format/states/media/capabilities). `fetch_shop_catalog`/`fetch_notices` take a `base_url` string arg — frontend passes `SHOP_API_BASE`.
- Render path: `PetViewport` + `createRenderer(format)`. Only `gif` implemented; extend `PetFormat` + `createRenderer` for new backends.

### Persistence / settings

- Store persisted via `@tauri-store/pinia` (`saveOnChange`) + `tauri-plugin-pinia`, auto-synced across windows. **Every persisted field MUST be in the initial `state()`** (use `null` for optional) — a key assigned later never enters `$state`, so it is never saved. Catalog lists are **not** persisted.
- Both windows call `petStore.$tauri.start()` in `App.vue` `onMounted` (guard with `__TAURI_INTERNALS__` for `pnpm dev`); main re-awaits it before the first `resizeWindow()`.
- Window side-effects run only in **main**: `alwaysOnTop`/`passThrough` watchers, `scale` resize, `currentPetId` reload, position capture (poll `outerPosition`/`outerSize` + save on close-requested; macOS NSPanel has **no `onMoved`**). Do NOT run these in the preference window.

### Env / build

- Dev base URL `VITE_SHOP_API_BASE` default `http://localhost:8080` (`.env.development`); override in gitignored `.env.development.local`. `petShop.ts` falls back to mock **only** in `import.meta.env.DEV`.
- Committed `.env.production` is a placeholder; the real value must come from `.env.production.local` (CI injects the `SHOP_API_BASE` secret; locally `SHOP_API_BASE=… pnpm prepare:env`). Never point prod builds at the placeholder.
- `pnpm sync:version` rewrites 3 tracked files — expected; revert with `git checkout -- package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml`.

### Window / input

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
