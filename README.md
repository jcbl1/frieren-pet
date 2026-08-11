# Frieren Pet

简易版桌宠框架，架构参考 [BongoCat](https://github.com/ayangweb/BongoCat)：

- **Tauri 2 + Vue 3 + TypeScript**
- 透明 / 无边框 / 置顶 / 跳过任务栏窗口
- 鼠标按住拖动，**Shift + 右键拖动** 缩放（以几何中心为基准）
- 独立设置窗口（托盘「设置」/ 二次启动自动打开）
- 配置持久化（Pinia + `@tauri-store/pinia`，自动落盘 + 跨窗口同步）
- 记住窗口位置（拖到哪，下次启动回到哪）
- 系统托盘：左键切换显示隐藏，菜单含 设置 / 显示 / 隐藏 / 退出
- **多角色**：内置预设 + 用户导入目录；设置页卡片切换
- **GIF 渲染**（`format: "gif"`）；Renderer 接口预留其它格式
- 关闭窗口仅隐藏，托盘常驻
- 跨平台：macOS / Windows / Linux(X11)

## 设置与持久化

设置项定义在 `src/stores/pet.ts`（Pinia option store）：

| 字段 | 默认 | 说明 |
|------|------|------|
| `currentPetId` | `"frieren"` | 当前角色 id（内置或用户导入） |
| `scale` | 60 | 窗口缩放（20–150），Shift+右键或设置窗可调 |
| `alwaysOnTop` | true | 始终置顶 |
| `opacity` | 100 | 透明度（10–100） |
| `passThrough` | false | 鼠标穿透 |
| `x` / `y` | null | 窗口位置（屏幕物理像素），null 表示从未保存 |

- 持久化走 `@tauri-store/pinia`（`saveOnChange`）+ Rust 侧 `tauri-plugin-pinia`，
  改动自动写盘、跨窗口实时同步；设置窗与主窗共用同一份状态。
- **每个要持久化的字段必须出现在 `state()` 初值里**（可选字段用 `null`）。
  事后往 option store 上挂新 key 不会进入 `$state`，也就不会被保存。
- 角色目录列表**不**持久化，每次打开设置页 / 启动时扫描；只持久化 `currentPetId`。
- 位置捕获在 **main 窗口** 内完成：400ms 轮询 `outerPosition/outerSize` +
  关窗（close-requested）时再存一次。macOS NSPanel 不派发 `onMoved`，
  原生拖拽会吞掉 mouseup，因此不能依赖事件，只能主动轮询。
- 启动时恢复已保存的 `x/y`（`availableMonitors` 校验是否在可见屏幕内，
  屏外则跳过恢复回到居中），并一次性恢复 scale。
- 缩放以几何中心为锚：几何中心存于 JS 模块态（`usePet.ts` 的 `center`），
  每次 resize 固定 `setPosition(center − target/2)`。macOS 上 `setSize/setPosition`
  为 GCD 异步派发，若逐次读窗口 frame 做中心保持会因时序不一致累积漂移，
  钉住 JS 侧 center 可结构性消除漂移。切换角色时同样钉中心缩放。

参考镜像（只读，勿提交）位于 `ref/BongoCat/`。macOS 上桌面浮层使用
`tauri-nspanel`（v2.1，源码 vendored 于 `vendor/tauri-nspanel/`，
因网络环境 github.com 不可达而改为本地 path 依赖）。

## 多角色与素材协议

### 目录布局

```
src-tauri/assets/pets/
├── manifest.json          # { "presets": ["frieren", "fern"] }
├── frieren/
│   ├── pet.json           # 状态协议（运行时加载）
│   ├── sleep.gif
│   ├── idle.gif           # 未使用
│   └── fallback.png       # preview
└── fern/
    ├── pet.json           # 无 click capability 的示例
    ├── sleep.gif
    └── preview.png

{appDataDir}/pets/<id>/    # 用户导入角色（与内置同结构）
├── pet.json
└── …
```

- 内置包随 `bundle.resources`（`assets/pets/**/*`）打包；`build.rs` 对 `assets/`
  做 `rerun-if-changed`，新增文件会触发 cargo 重拷资源。
- 用户包在应用数据目录 `pets/` 下；导入由 Rust 命令 `import_pet` 校验并复制，
  删除走 `delete_pet`（内置不可删）。
- **`resourceDir` 不写进 `pet.json`**：加载器在运行时注入
  （预设 = `resolveResource('assets/pets/<id>')`，用户 = `appDataDir/pets/<id>`）。

### `pet.json`（v1）

```jsonc
{
  "id": "frieren",
  "name": "Frieren",
  "format": "gif",
  "width": 736,
  "height": 736,
  "defaultState": "sleep",
  "preview": "fallback.png",
  "capabilities": {
    "click": "click",
    "doubleClick": { "state": "click", "cooldownMs": 500 },
    "idle": { "state": "sleep", "afterMs": 45000 }
  },
  "states": {
    "sleep": { "src": "sleep.gif", "loop": true },
    "click": {
      "src": "sleep.gif",
      "loop": false,
      "durationMs": 800,
      "next": "sleep"
    }
  }
}
```

| 字段 | 说明 |
|------|------|
| `id` | `/^[a-z0-9][a-z0-9_-]{0,63}$/i`；用户包不得与内置 id 冲突 |
| `format` | 渲染后端；当前仅 `"gif"`，未知格式拒绝加载 |
| `width` / `height` | 角色基准尺寸，窗口按 `petStore.scale` 缩放 |
| `defaultState` | 启动 / 切换角色后的初始状态，必须 ∈ `states` |
| `preview` | 设置页缩略图（相对包根）；缺省用 `defaultState` 的 `src` |
| `capabilities` | UI **意图** → 本角色状态名；值可为字符串简写 `"state"` 或对象 `{ state, cooldownMs?, afterMs? }`；缺 key 或目标 state 不存在 → **静默 no-op** |
| `capabilities.*.cooldownMs` | 同意图最小触发间隔（防连发），可选项 |
| `capabilities.*.afterMs` | 仅 `idle` 用：空闲触发延时；缺省全局 60s |
| `states.*.src` | 相对包根的媒体文件 |
| `states.*.durationMs` + `next` | 一次性动画结束后切换的状态 |

内置 `fern` 无 `capabilities.click`，点击主窗无动画，用于验证能力声明。

### 意图与状态机

主窗 UI **不** hardcode 状态名：

- 单击 → `invoke('click')`（先触发；双击时随后再触发 `doubleClick`，无点击延迟）
- 双击 → `invoke('doubleClick')`
- 鼠标进入 → `invoke('mouseEnter')`（同时重置空闲定时）
- 鼠标离开 → `invoke('mouseLeave')`
- 拖动开始（越过阈值）→ `invoke('dragStart')`，随后 `startDragging()`
- 拖动结束（mouseup）→ `invoke('dragEnd')`
- 右键 → `invoke('rightClick')`（`preventDefault` 屏蔽原生菜单；Shift+右键缩放时不触发）
- 空闲定时 → `invoke('idle')`（`afterMs` 由 `capabilities.idle` 配置，缺省 60s）
- 启动 / 切角 → `start()` / `reloadPet()` → `setState(config.defaultState)`

映射在 `usePet.ts`：`invoke(cap)` 读 `capabilities[cap]` → `setState`。状态名完全由各角色自定义。

> **macOS 限制**：原生拖拽会吞掉 mouseup（与位置保存同因，见「设置与持久化」），因此
> `dragEnd` 在 macOS 上可能不触发；`dragStart` 在 `startDragging()` 前触发，各平台可靠。

### 渲染

- `src/renderers/`：`PetRenderer` 接口 + `createRenderer(format)` + `GifRenderer`
- `src/components/PetViewport.vue`：按 `config.format` 挂载 renderer，watch state/src
- 一期仅 GIF（`<img>` + `convertFileSrc`）；其它格式只需实现接口并扩展 `PetFormat`

### 设置页：角色

- 卡片列表（预设 + 用户「导入」徽标）
- 点击切换 → 写 `petStore.currentPetId`（pinia 跨窗同步 → main `watch` → `reloadPet`）
- 「导入角色」：选目录 → 前端读 id 做覆盖确认 → `invoke('import_pet')` 校验/复制
- 用户卡可删；删当前角色则回落到列表第一项

### 导入校验（Rust `utils/pet_import.rs`）

- 必填：`id` `name` `format` `width` `height` `defaultState` `states`
- `defaultState` / `capabilities.*`（字符串或对象两种形式）/ `states.*.next` 目标均须 ∈ `states`
- 每个 `states.*.src`（及可选 `preview`）文件必须存在于所选目录
- `format` ∈ 支持列表（当前 `gif`）
- 与 `manifest.json` 内置 id 冲突 → 拒绝；同 id 用户包 → 覆盖前确认

## 开发

需要 Node ≥ 18、pnpm、Rust、Tauri 系统依赖（Linux 见下）。

```bash
pnpm install
pnpm tauri dev
```

前端单独跑（仅 Vite）：`pnpm dev`

类型检查：`pnpm typecheck`  
Rust（改过 `src-tauri` 后）：`cargo check -p frieren-pet`

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
│   ├── pages/main/         #   桌宠主窗口（意图 → invoke）
│   ├── pages/preference/   #   设置：角色卡片 / 导入删除 / 窗口 / 关于
│   ├── components/         #   PetViewport（renderer 宿主）
│   ├── composables/usePet  #   状态机 + 切角 + 中心缩放 + 位置捕获
│   ├── services/
│   │   ├── petConfig.ts    #   加载/校验 pet.json、manifest、用户根目录
│   │   └── petCatalog.ts   #   目录列表 + 导入/删除封装
│   ├── renderers/          #   PetRenderer + gif + createRenderer
│   ├── types/pet.ts        #   pet.json v1 协议类型
│   ├── stores/pet.ts       #   Pinia（含 currentPetId，持久化）
│   └── assets/             #   css 等（角色资源在 src-tauri/assets/pets）
└── src-tauri/
    ├── tauri.conf.json     # 窗口/资源/打包（main + preference）
    ├── tauri.*.conf.json   # 各平台覆盖
    ├── capabilities/       # pinia、fs、dialog、outer-position/size 等
    ├── assets/pets/        # manifest + 内置角色包
    └── src/
        ├── lib.rs          # 入口、import_pet/delete_pet、单实例、关窗隐藏
        ├── utils/pet_import.rs  # 导入校验与目录复制
        └── setup/          # 托盘、macOS panel
```

## 后续可扩展

- 跟随光标
- 全局键鼠/手柄驱动动作（BongoCat 的 `rdev`/`gilrs`）
- 其它渲染后端（序列帧 / Live2D / 透明视频）：实现 `PetRenderer` 并扩展 `format`
- zip 一键角色包、远程角色源
- 托盘 / 右键快速切角
- 每角色独立 scale / 位置（需在 store 初值中预留嵌套结构）
