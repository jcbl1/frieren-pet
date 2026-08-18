# 构建与发布

## 本地命令

项目统一使用 pnpm scripts，不要求安装 Make：

| 命令 | 用途 |
|------|------|
| `pnpm check` | 前端类型检查 + Rust `cargo check` |
| `pnpm build` | 仅构建前端到 `dist/` |
| `pnpm build:tauri` | 构建前端并打包当前宿主平台 |
| `pnpm tauri dev` | 启动 Tauri 开发环境 |

`pnpm build:tauri` 等价于 `pnpm tauri build`。Tauri 会先执行
`beforeBuildCommand`（即 `pnpm build`），然后由 Rust 完成当前宿主平台的打包。

## Release Workflow

真实发布流程以 [`.github/workflows/release.yml`](../.github/workflows/release.yml) 为准。
它由推送 `v*` tag 触发，并在以下 runner 上构建：

| 平台 | 参数 |
|------|------|
| macOS | `--target aarch64-apple-darwin` |
| macOS | `--target x86_64-apple-darwin` |
| Ubuntu 22.04 | 默认 target |
| Windows | 默认 target |

每个 matrix job 的步骤顺序为：

1. 使用 Node 22、pnpm 9 和 Rust stable。
2. 安装依赖：`pnpm install --frozen-lockfile`。
3. 执行 `pnpm typecheck` 和 `cargo check -p frieren-pet`。
4. 从 tag 同步 `package.json`、`src-tauri/tauri.conf.json` 和 `src-tauri/Cargo.toml` 的版本。
5. 从 `SHOP_API_BASE` secret 生成 `.env.production.local`。
6. 校验 `TAURI_SIGNING_PRIVATE_KEY` 为非空且为有效 base64。
7. 通过 `tauri-action` 构建并发布安装包、签名文件和 updater metadata。

本地复现发布构建：

```bash
nvm use 22
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm sync:version v1.2.3
SHOP_API_BASE=https://shop.example.com pnpm prepare:env
pnpm build:tauri
```

预发布版本同样支持，例如：

```bash
pnpm sync:version v1.2.3-rc.1
```

版本脚本会移除 tag 开头的 `v`，并接受 SemVer 的 prerelease/build metadata。
包含连字符的 tag（例如 `v1.2.3-rc.1`）会由 workflow 标记为 GitHub prerelease；普通版本会创建为正式 release。

`pnpm sync:version` 会修改 3 个已跟踪文件，这是预期行为。若本地复现后不想保留版本修改，可使用：

```bash
git restore package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
```

`pnpm prepare:env` 要求 `SHOP_API_BASE` 已设置，并写入被 gitignore 的
`.env.production.local`。不要直接依赖提交的 `.env.production` 占位地址；省略环境注入时，构建本身不会自动报错。

## CI secrets

发布前需要在仓库 Settings > Secrets 中配置：

| Secret | 必需 | 用途 |
|--------|------|------|
| `SHOP_API_BASE` | 是 | 生产商店和公告 API 基地址 |
| `TAURI_SIGNING_PRIVATE_KEY` | 是 | updater 产物签名私钥，必须是有效 base64 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 否 | 私钥口令；未设置时 workflow 使用空字符串 |

`GITHUB_TOKEN` 由 GitHub Actions 自动提供，用于创建 release 和上传产物。

## 自动更新

- `tauri.conf.json` 已启用 `bundle.createUpdaterArtifacts` 与 updater plugin。
- updater endpoint：
  `https://github.com/jcbl1/frieren-pet/releases/latest/download/latest.json`
- 正式版本会发布为非 Draft Release，因此可被 `latest.json` endpoint 发现。
- prerelease 不会成为 GitHub latest release，不能作为正式版本的自动更新来源。
- 生成签名密钥：

  ```bash
  pnpm tauri signer generate -w ~/.tauri/frieren-pet.key
  ```

  公钥已写入 `src-tauri/tauri.conf.json`。私钥丢失后无法继续发布可更新版本。

## 发布后检查

发布完成后至少确认：

- GitHub Release 状态、版本号和 prerelease 标记正确。
- macOS、Linux、Windows 安装包及 `.sig` 文件均已上传。
- 正式版本的 `latest.json` 可访问。
- 全新安装可以启动，已有旧版本可以检查并安装更新。

macOS 尚未配置代码签名和公证，可能受到 Gatekeeper 限制；Windows 代码签名也尚未配置，详见 [roadmap.md](roadmap.md)。
