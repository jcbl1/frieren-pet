# 架构

## 目录结构

```
├── Cargo.toml              # workspace → src-tauri
├── src/                    # Vue3 前端
│   ├── main.ts             # createApp + pinia(@tauri-store) + router
│   ├── App.vue             # RouterView + store 启动 + 窗体样式分支
│   ├── router/             # hash 路由：#/（主窗）、#/preference（设置窗）
│   ├── pages/main/         # 桌宠主窗：意图 → invoke、拖动、缩放
│   ├── pages/preference/   # 设置窗：角色 / 商店 / 外观 / 关于
│   ├── composables/usePet.ts  # 状态机、切角、中心缩放、位置捕获
│   ├── services/
│   │   ├── petConfig.ts    # 加载/校验 pet.json、manifest、用户根目录
│   │   ├── petCatalog.ts   # 目录列表 + 导入/删除封装
│   │   └── petShop.ts      # 商店目录 / 安装（后端不可达回落 mock）
│   ├── renderers/          # PetRenderer + gif + createRenderer
│   ├── types/pet.ts        # pet.json v1 类型
│   ├── stores/pet.ts       # Pinia 设置态（持久化）
│   └── assets/
├── src-tauri/
│   ├── tauri.conf.json     # 窗口 / 资源 / 打包
│   ├── tauri.*.conf.json   # 各平台覆盖
│   ├── capabilities/       # pinia、fs、dialog、outer-position/size 等
│   ├── assets/pets/        # manifest + 内置角色包
│   └── src/
│       ├── lib.rs          # 入口、import_pet/delete_pet、单实例、关窗隐藏
│       ├── utils/pet_import.rs  # 导入校验与目录复制
│       └── setup/          # 托盘、macOS panel
├── vendor/tauri-nspanel/   # macOS 浮层库（vendored，勿 fetch）
└── ref/                    # BongoCat 只读镜像（勿提交）
```

## 设置与持久化

设置定义在 `src/stores/pet.ts`（Pinia option store），经 `@tauri-store/pinia`（`saveOnChange`）+
`tauri-plugin-pinia` 自动落盘并跨窗口同步；设置窗与主窗共用同一份状态。

| 字段 | 默认 | 说明 |
|------|------|------|
| `currentPetId` | `"frieren"` | 当前角色 id（内置或用户导入） |
| `scale` | 100 | 窗口缩放（20–150），Shift+右键或外观页可调 |
| `alwaysOnTop` | true | 始终置顶 |
| `opacity` | 100 | 透明度（10–100），作用于主窗内容 |
| `passThrough` | false | 鼠标穿透 |
| `idleEnabled` | true | 空闲动画开关 |
| `idleAfterMs` | null | 空闲延时（毫秒）；null = 用 `capabilities.idle.afterMs`（缺省 60s） |
| `theme` | `"auto"` | 主题：`light` / `dark` / `auto` |
| `autoCheckUpdates` | true | 自动检查更新 |
| `systemNotifications` | true | 系统通知开关（公告等） |
| `launchAtStartup` | false | 开机自启（`tauri-plugin-autostart`） |
| `x` / `y` | null | 窗口位置（物理像素），null = 从未保存 |

规则：

- **每个要持久化的字段必须出现在 `state()` 初值里**（可选字段用 `null`）；
  事后挂新 key 不会进入 `$state`，也就不会被保存
- 角色目录列表**不**持久化，启动 / 打开设置页时扫描
- 公告相关（`pendingNotices` / `dismissedNoticeIds` / `notifiedNoticeIds`）为会话级状态，启动时清空

## 日志

日志由 `tauri-plugin-log` 统一处理。前端通过 `src/services/logger.ts` 写入，Tauri/Rust 通过 `log` crate 写入；浏览器开发模式下自动回退到 `console`。

- 开发时：日志输出到 Tauri 终端和 WebView console
- 持久化：写入应用日志目录，单文件上限 5 MB
- Linux：`$XDG_DATA_HOME/{bundleIdentifier}/logs`，通常为 `~/.local/share/{bundleIdentifier}/logs`
- macOS：`~/Library/Logs/{bundleIdentifier}`
- Windows：`%LOCALAPPDATA%/{bundleIdentifier}/logs`
- 渲染器、角色加载、导入、商店、更新和未捕获异常均通过统一日志记录；Live2D 分支可直接复用该 logger

## 窗口行为（main 窗）

- **位置捕获**：400ms 轮询 `outerPosition` / `outerSize`，关窗（close-requested）时再存一次。
  macOS NSPanel 不派发 `onMoved`、原生拖拽吞 mouseup，只能主动轮询
- **位置恢复**：启动时恢复已保存 `x/y`，用 `availableMonitors` 校验是否在可见屏幕内，
  屏外则跳过恢复回到居中；仅恢复一次
- **缩放**：`resizeWindow()` 单飞合并；目标尺寸 = 屏幕短边 × 25% × `scale/100`；
  以 JS 模块态里的几何 `center` 为锚，每次 resize 固定 `setPosition(center − target/2)`——
  macOS 的 `setSize`/`setPosition` 为 GCD 异步派发，逐次读 frame 会累积漂移，钉住 center 结构性消除
- **拖动**：用 `appWindow.startDragging()`（越过阈值后），非自算 `setPosition`
- **空闲**：拖动中暂停空闲定时（`setDragActive`）；`wake()` 清标记，避免 macOS 吞 mouseup 后卡死
- **其它**：`mousedown` `preventDefault` + 全局 `user-select: none`；
  关窗仅隐藏（托盘常驻）；窗口标签 `main` / `preference`，NSPanel 转换仅作用于 `main`

窗口副作用（置顶 / 穿透 / scale 缩放 / 切角 reload / 位置捕获）只在 main 窗运行，设置窗不执行。

## 平台笔记

- **macOS**：主窗转 NSPanel（`src-tauri/src/setup/macos.rs`，`cfg(target_os = "macos")` 限定）；
  `macOSPrivateApi: true` 保证透明；依赖 vendored `vendor/tauri-nspanel/`
- **无交叉编译**：各 OS 在自己的平台上构建
- **Linux**：透明 + 置顶需 X11 合成器；无头环境排障见 [docs/setup.md](setup.md)

## 后续可扩展

- 跟随光标；全局键鼠 / 手柄驱动动作（BongoCat 的 `rdev` / `gilrs`）
- 其它渲染后端（序列帧 / Live2D / 透明视频）
- 托盘 / 右键快速切角；每角色独立 scale / 位置（需在 store 初值中预留嵌套结构）
