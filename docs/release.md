# 构建与发布

## 本地 Release 构建

本地构建与 release workflow 对齐的入口是：

```bash
pnpm release:build v1.2.3
```

预发布版本也支持：

```bash
pnpm release:build v1.2.3-rc.1
```

首次使用需要准备一次本地配置。将 `.env.production` 复制为
`.env.production.local`，然后填写：

| 配置项 | 必需 | 用途 |
|--------|------|------|
| `VITE_SHOP_API_BASE` | 是 | 生产商店和公告 API 基地址 |
| `TAURI_SIGNING_PRIVATE_KEY` | 是 | updater 产物签名私钥，必须是有效 base64 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 否 | 私钥口令 |

`.env.production.local` 已被 gitignore。`VITE_SHOP_API_BASE` 是 Vite 使用的唯一 API 配置名；签名变量没有 `VITE_` 前缀，不会暴露给前端代码。没有 updater 私钥时，不能生成与 CI 一致的已签名产物；命令会在构建前失败并提示原因，而不会生成误导性的未签名 release 产物。

`pnpm release:build` 会自动完成：

1. 读取并校验本地 production 配置。
2. 执行 `pnpm check`。
3. 根据命令参数同步三个版本文件。
4. 执行实际的 `pnpm tauri build`。
5. 构建结束后恢复版本文件。

命令只构建当前宿主平台。macOS、Linux、Windows 的完整 release matrix 仍由 GitHub Actions 负责。

日常开发命令：

| 命令 | 用途 |
|------|------|
| `pnpm check` | 前端类型检查 + Rust `cargo check` |
| `pnpm build` | 仅构建前端到 `dist/` |
| `pnpm tauri build` | 直接构建当前宿主平台，不执行 release 准备流程 |
| `pnpm tauri dev` | 启动 Tauri 开发环境 |

## Release Workflow

真实发布流程以 [`.github/workflows/release.yml`](../.github/workflows/release.yml) 为准。它由推送 `v*` tag 触发，并在以下 runner 上构建：

| 平台 | 参数 |
|------|------|
| macOS | `--target aarch64-apple-darwin` |
| macOS | `--target x86_64-apple-darwin` |
| Ubuntu 22.04 | 默认 target |
| Windows | 默认 target |

每个 matrix job 会执行类型检查、Rust 检查、tag 版本同步、生产环境注入、签名密钥校验，然后通过 `tauri-action` 构建并发布安装包、签名文件和 updater metadata。

tag 版本支持普通版本和 prerelease，例如 `v1.2.3`、`v1.2.3-rc.1`。包含连字符的 tag 会被 workflow 标记为 GitHub prerelease；普通版本会创建为正式 release。

## 自动更新

- updater endpoint：`https://github.com/jcbl1/frieren-pet/releases/latest/download/latest.json`
- 正式版本会发布为非 Draft Release，因此可被 `latest.json` endpoint 发现。
- prerelease 不会成为 GitHub latest release，不能作为正式版本的自动更新来源。
- 生成签名密钥：

  ```bash
  pnpm tauri signer generate -w ~/.tauri/frieren-pet.key
  ```

  公钥已写入 `src-tauri/tauri.conf.json`。私钥丢失后无法继续发布可更新版本。

macOS 尚未配置代码签名和公证，可能受到 Gatekeeper 限制；Windows 代码签名也尚未配置，详见 [roadmap.md](roadmap.md)。
