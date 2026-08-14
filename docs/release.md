# 构建与发布

## 本地构建

```bash
pnpm tauri build
```

前端产物先由 `beforeBuildCommand`（`pnpm build`）生成到 `dist/`，再走 Rust 打包（宿主默认目标）。

## 与 release workflow 对齐

`pnpm tauri build` 只保证「能打包」；要让本地产物与 [`.github/workflows/release.yml`](../.github/workflows/release.yml)
一致，需复刻其版本同步与环境注入两步：

```bash
nvm use 22                                   # .nvmrc；CI 用 Node 22
corepack enable                              # 按 packageManager 钉 pnpm 9.x
pnpm install --frozen-lockfile               # 与 CI 相同锁文件
pnpm sync:version vX.Y.Z                     # 同步 package.json / tauri.conf.json / Cargo.toml
SHOP_API_BASE=<url> pnpm prepare:env         # 写 .env.production.local；缺失即失败（同 CI）
pnpm tauri build                             # 宿主默认目标
```

- tag `vX.Y.Z` 触发 CI：先跑 `scripts/sync-version.mjs` 统一三处版本号，再从 `SHOP_API_BASE`
  secret 注入 `.env.production.local`
- `pnpm sync:version` 会改写 3 个已跟踪文件（预期副作用）；不保留时
  `git checkout -- package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml`
- `pnpm prepare:env` 复刻 CI 的 secret 注入：`SHOP_API_BASE` 未设置即 `exit 1`，
  避免误用提交的 `.env.production` 占位后端
- CI matrix：macOS 打 `aarch64-apple-darwin` / `x86_64-apple-darwin`，
  Linux(ubuntu-22.04) / Windows 用默认目标；**无交叉编译**，
  本地复现对应目标需在对应 OS 上 `pnpm tauri build --target <triple>`

## 自动更新（updater）

- `tauri.conf.json` 已启用 `bundle.createUpdaterArtifacts` 与 `plugins.updater`
  （endpoint = `https://github.com/jcbl1/frieren-pet/releases/latest/download/latest.json`）
- CI 通过 `tauri-action` 自动生成 `.sig` 签名并上传 `latest.json`；
  依赖两个 GitHub Secrets：`TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- 密钥对生成（本地，一次性）：`pnpm tauri signer generate -w ~/.tauri/frieren-pet.key`
  公钥已写入 `tauri.conf.json`；私钥务必妥善保管，丢失后无法再发布可更新的版本
- **未配置这两个 secret 前，发版 CI 会失败**；在仓库 Settings > Secrets 添加后再打 tag
- 分发限制：macOS 需代码签名/公证否则 Gatekeeper 拦截更新（见 roadmap 项 2）
