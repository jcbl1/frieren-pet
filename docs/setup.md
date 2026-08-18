# 环境搭建

新开发者从零到能跑的完整流程；日常命令清单见 [AGENTS.md](../AGENTS.md)。

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node | 22（`.nvmrc`） | 用 nvm 管理 |
| pnpm | 9（`packageManager` 钉 9.15.9） | 用 corepack 钉版本 |
| Rust | stable | rustup |

## 1. 克隆并准备工具链

```bash
git clone https://github.com/jcbl1/frieren-pet.git && cd frieren-pet
nvm install 22 && nvm use
corepack enable
rustup install stable
```

## 2. 安装平台依赖

Linux (Ubuntu)：

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libgtk-3-dev
```

> 透明 + 置顶依赖 X11 合成器；Wayland 下行为可能受限。

macOS：装 Xcode CLT；首次生成 `.icns` 图标
（`pnpm tauri icon ./src-tauri/assets/logo.png` + 在 `bundle.icon` 加 `icons/icon.icns`）。

Windows：装 VS Build Tools（WebView2 在 Win11 自带）。

## 3. 安装依赖

```bash
pnpm install --frozen-lockfile
```

## 4. 验证环境

```bash
pnpm check
```

`pnpm check` 会依次执行前端类型检查和 `cargo check -p frieren-pet`。

## 5. 运行

```bash
pnpm tauri dev      # 全栈：Tauri 窗口 + 桌宠
pnpm dev            # 仅前端 Vite（无 Tauri API / 窗口）
```

前端构建和桌面应用构建：

```bash
pnpm build          # 仅生成 dist/
pnpm tauri build    # 生成前端并打包当前宿主平台
```

需要复现 release workflow 的本地构建时，使用 [README 的 Release 构建流程](../README.md#本地构建-release-产物)，不要手动分别执行版本同步和环境注入命令。

shop 后端不可达时自动回落 mock（`src/services/petShop.ts`），无需后端即可启动。
联调 shop 时改 gitignored 的 `.env.development.local` 里的 `VITE_SHOP_API_BASE`
（默认 `http://localhost:8080`），勿改提交的 `.env.development`。

## 无头 / 容器排障

容器或 CI 中 WebKitGTK 沙箱会拦截页面请求导致窗口空白：

```bash
xvfb-run -a pnpm tauri dev
```

仍空白则禁用 WebKit 沙箱与合成：

```bash
WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 \
WEBKIT_DISABLE_COMPOSITING_MODE=1 \
WEBKIT_DISABLE_DMABUF_RENDERER=1 \
  ./target/debug/frieren-pet
```

无托盘主机时托盘创建失败不会阻止应用启动（仅告警）。

## 双宿主共享目录（macOS 宿主 + Linux 容器）

项目目录在 macOS 与 Linux 之间共用时，同一份 `node_modules` 需包含两套平台的原生二进制；
`package.json` 的 `pnpm.supportedArchitectures` 已列 darwin / linux / win32 与 arm64 / x64，两端无需重复安装。

> pnpm 9 该配置只能写在 `package.json` 的 `pnpm` 字段，`.npmrc` 不生效。

Rust 的 `target/` 为宿主原生产物无法共用，切换宿主会自动重编（首次较慢）；
高频切换可用 `CARGO_TARGET_DIR` 分流。
