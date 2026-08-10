# Frieren Pet

简易版桌宠框架，架构参考 [BongoCat](https://github.com/ayangweb/BongoCat)：

- **Tauri 2 + Vue 3 + TypeScript**
- 透明 / 无边框 / 置顶 / 跳过任务栏窗口
- 鼠标按住拖动，**Shift + 右键拖动** 缩放（以几何中心为基准）
- 独立设置窗口（托盘「设置」/ 二次启动自动打开）
- 配置持久化（Pinia + `@tauri-store/pinia`，自动落盘 + 跨窗口同步）
- 记住窗口位置（拖到哪，下次启动回到哪）
- 系统托盘：左键切换显示隐藏，菜单含 设置 / 显示 / 隐藏 / 退出
- 精灵（GIF）状态机：`sleep` / `click`，素材为 `frieren_sleeping`（睡觉 GIF）
- 关闭窗口仅隐藏，托盘常驻
- 跨平台：macOS / Windows / Linux(X11)

## 设置与持久化

设置项定义在 `src/stores/pet.ts`（Pinia option store）：

| 字段 | 默认 | 说明 |
|------|------|------|
| `scale` | 60 | 窗口缩放（20–150），Shift+右键或设置窗可调 |
| `alwaysOnTop` | true | 始终置顶 |
| `opacity` | 100 | 透明度（10–100） |
| `passThrough` | false | 鼠标穿透 |
| `x` / `y` | null | 窗口位置（屏幕物理像素），null 表示从未保存 |

- 持久化走 `@tauri-store/pinia`（`saveOnChange`）+ Rust 侧 `tauri-plugin-pinia`，
  改动自动写盘、跨窗口实时同步；设置窗与主窗共用同一份状态。
- 位置捕获在 **main 窗口** 内完成：400ms 轮询 `outerPosition/outerSize` +
  关窗（close-requested）时再存一次。macOS NSPanel 不派发 `onMoved`，
  原生拖拽会吞掉 mouseup，因此不能依赖事件，只能主动轮询。
- 启动时恢复已保存的 `x/y`（`availableMonitors` 校验是否在可见屏幕内，
  屏外则跳过恢复回到居中），并一次性恢复 scale。
- 缩放以几何中心为锚：几何中心存于 JS 模块态（`usePet.ts` 的 `center`），
  每次 resize 固定 `setPosition(center − target/2)`。macOS 上 `setSize/setPosition`
  为 GCD 异步派发，若逐次读窗口 frame 做中心保持会因时序不一致累积漂移，
  钉住 JS 侧 center 可结构性消除漂移。

参考镜像（只读，勿提交）位于 `ref/BongoCat/`。macOS 上桌面浮层使用
`tauri-nspanel`（v2.1，源码 vendored 于 `vendor/tauri-nspanel/`，
因网络环境 github.com 不可达而改为本地 path 依赖）。

## 素材与状态协议

角色资源在 `src-tauri/assets/pets/<id>/`：

```
assets/pets/frieren/
├── sleep.gif     # ← frieren_sleeping.gif（当前唯一在用素材）
├── idle.gif      # ← frieren_breathing.gif（未使用）
└── fallback.png  # ← frieren_no_bg.png（未使用）
```

状态定义在 `src/assets/pets/frieren/pet.json`：

```jsonc
{
  "id": "frieren",
  "resourceDir": "assets/pets/frieren",
  "width": 736,
  "height": 736,
  "defaultState": "sleep",
  "states": {
    "sleep": { "src": "sleep.gif", "loop": true },
    "click": { "src": "sleep.gif", "loop": false, "durationMs": 800, "next": "sleep" }
  }
}
```

- `width/height` 为角色基准尺寸，窗口按 `petStore.scale` 缩放
- `durationMs` + `next` 表示一次性动画播完后切换到的状态
- 默认行为：`sleep` 循环；点击播放 `click` 动画后回到 `sleep`

## 开发

需要 Node ≥ 18、pnpm、Rust、Tauri 系统依赖（Linux 见下）。

```bash
pnpm install
pnpm tauri dev
```

前端单独跑（仅 Vite）：`pnpm dev`

### 双宿主共享目录（macOS 宿主 + Linux 容器）

项目目录由 macOS 宿主与 Linux 容器共用时，同一份 `node_modules` 需同时包含两套平台的原生二进制
（esbuild/rollup/tauri-cli 按 `process.platform` 运行时自动选择）。

已在 `package.json` 配置 `pnpm.supportedArchitectures`，包含 darwin / linux / win32 与 arm64 / x64：
两端共用一份 `node_modules`，**切换宿主无需重新安装**。

> pnpm 9 该配置只能写在 `package.json` 的 `pnpm` 字段（`supportedArchitectures`），`.npmrc` 不生效。

补充说明：
- Rust 的 `target/` 为各宿主原生编译产物，无法共用；切换宿主 cargo 会自动重编（首次较慢），
  高频切换可用 `CARGO_TARGET_DIR` 分流。
- macOS 首次需在宿主机装 Xcode CLT / Rust / Node / pnpm，并生成 `.icns` 图标
  （`pnpm tauri icon ./src-tauri/assets/logo.png` + 在 `bundle.icon` 加 `icons/icon.icns`）。

### Linux (Ubuntu) 系统依赖

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libgtk-3-dev
```

> 注：Linux 上透明 + 置顶依赖 X11 合成器；Wayland 下行为可能受限。

#### 无头 / 容器排障

容器或 CI 中 WebKitGTK 沙箱会拦截页面请求，导致窗口空白。用虚拟显示器运行：

```bash
xvfb-run -a pnpm tauri dev
```

若页面仍空白，显式禁用 WebKit 沙箱与合成：

```bash
WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1 \
WEBKIT_DISABLE_COMPOSITING_MODE=1 \
WEBKIT_DISABLE_DMABUF_RENDERER=1 \
  ./target/debug/frieren-pet
```

无托盘主机时托盘创建失败不会阻止应用启动（仅告警）。

## 构建

```bash
pnpm tauri build
```

## 目录结构

```
core/
├── Cargo.toml              # workspace → src-tauri
├── vendor/tauri-nspanel/   # macOS 桌面浮层库（vendored）
├── src/                    # Vue3 前端
│   ├── main.ts             #   createApp + pinia(+tauri-store) + router
│   ├── App.vue             #   RouterView + store 启动 + 窗体样式分支
│   ├── router/             #   hash 路由：#/（主窗）、#/preference（设置窗）
│   ├── pages/main/         #   桌宠主窗口
│   ├── pages/preference/   #   设置窗口（缩放/透明度/置顶/穿透/关于）
│   ├── composables/usePet  #   状态机 + 资源解析 + 中心缩放 + 位置捕获
│   ├── stores/pet          #   Pinia 配置 store（持久化）
│   └── assets/pets/        #   pet.json 状态协议
└── src-tauri/
    ├── tauri.conf.json     # 窗口/资源/打包配置（main + preference 双窗）
    ├── tauri.*.conf.json   # 各平台覆盖
    ├── capabilities/       # 前端权限（含 pinia、outer-position/size）
    ├── assets/pets/        # GIF 素材（asset protocol 提供）
    └── src/
        ├── lib.rs          # 应用入口、单实例（二次启动→设置窗）、关窗隐藏
        └── setup/          # 托盘（设置/显示/隐藏/退出）、macOS panel
```

## 后续可扩展

- 跟随光标
- 全局键鼠/手柄驱动动作（BongoCat 的 `rdev`/`gilrs`）
- Live2D 渲染后端（保留 `usePet` 接口，可替换）
- 多角色
