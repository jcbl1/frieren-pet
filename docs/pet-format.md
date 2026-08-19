# 角色格式（pet.json v1）

角色（pet）是桌宠的载体：一份 `pet.json` + 若干媒体文件，声明尺寸、默认状态与「意图 → 状态」映射。
内置包在 `src-tauri/assets/pets/<id>/`，用户导入 / 商店安装的包在 `{appDataDir}/pets/<id>/`，结构一致。

## 目录布局

```
src-tauri/assets/pets/
├── manifest.json          # { "presets": ["frieren", "fern"] }
├── frieren/
│   ├── pet.json
│   ├── sleep.gif
│   ├── idle.gif           # 未使用
│   └── fallback.png       # preview
└── fern/
    ├── pet.json           # 无 click capability 的示例
    ├── sleep.gif
    └── preview.png
```

- 内置包随 `bundle.resources`（`assets/pets/**/*`）打包；`build.rs` 对 `assets/` 做 `rerun-if-changed`
- 内置 id 以 `manifest.json` 为准（**不是**对 bundle 目录 `readDir`）；用户包从 `{appDataDir}/pets/*` 扫描
- **`resourceDir` 不写进 `pet.json`**：运行时注入
  （预设 = `resolveResource('assets/pets/<id>')`，用户 = `appDataDir/pets/<id>`）

## pet.json

```jsonc
{
  "id": "frieren",
  "name": "Frieren",
  "format": "gif",
  "width": 736,
  "height": 736,
  "scale": 1,
  "defaultState": "sleep",
  "version": "1.0.0",
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
| `name` | 显示名 |
| `format` | 渲染后端；当前支持 `"gif"` 和 `"live2d"`，未知格式拒绝加载 |
| `ratio` | 可选的新格式窗口宽高比；存在时优先于 `width / height` |
| `width` / `height` | 兼容旧格式的角色基准尺寸（宽高比）；必须同时提供。未提供 `ratio` 时使用 `width / height` |
| `scale` | 可选的角色默认尺寸倍率，缺省为 `1`；窗口尺寸还会叠加用户设置的 `scale/100` |
| `defaultState` | 启动 / 切换角色后的初始状态，必须 ∈ `states` |
| `version` | 可选，角色版本号（如 `1.0.0`）。商店用它与 `catalog.items[].version` 对比，检测是否可更新；缺省视为旧版可更新 |
| `preview` | 设置页缩略图（相对包根）；缺省用 `defaultState` 的 `src` |
| `capabilities` | UI **意图** → 状态名。值可为字符串 `"state"` 或对象 `{ state, cooldownMs?, afterMs? }`；缺 key / 目标状态不存在 → **静默 no-op** |
| `capabilities.*.cooldownMs` | 同一意图最小触发间隔（防连发） |
| `capabilities.*.afterMs` | 仅 `idle`：空闲触发延时；缺省 60s |
| `states.*.src` | 相对包根的媒体文件 |
| `states.*.loop` | 循环播放 |
| `states.*.durationMs` + `next` | 一次性动画播完后的下一状态；缺省 `next` 回到 `defaultState` |

## 意图与状态机

主窗 UI **不** hardcode 状态名：意图 → `usePet.invoke(cap)` → 读 `capabilities[cap]` → `setState`。

| 意图 | 触发 |
|------|------|
| `click` / `doubleClick` | 单击 / 双击（双击时单击先触发） |
| `mouseEnter` / `mouseLeave` | 鼠标进入 / 离开（进入同时重置空闲定时） |
| `dragStart` / `dragEnd` | 拖动越过阈值后 / 松开 |
| `rightClick` | 右键（屏蔽原生菜单；Shift+右键缩放时不触发） |
| `idle` | 空闲定时到点（`capabilities.idle.afterMs`，缺省 60s；拖动中暂停） |
| 启动 / 切角 | `start()` / `reloadPet()` → `setState(defaultState)` |

> **macOS 限制**：原生拖拽会吞掉 mouseup，`dragEnd` 可能不触发；`dragStart` 在 `startDragging()` 前触发，各平台可靠。

## 渲染

- `src/renderers/`：`PetRenderer` 接口 + `createRenderer(format)` + `GifRenderer`（`<img>` + `convertFileSrc`）
- `src/components/PetViewport.vue`：按 `config.format` 挂载 renderer，watch state/src
- 新增格式：实现 `PetRenderer` 接口 + 扩展 `PetFormat` 与 `createRenderer`

## 导入校验（Rust `utils/pet_import.rs`）

- 必填：`id` `name` `format` `width` `height` `defaultState` `states`
- `defaultState` / `capabilities.*` / `states.*.next` 目标均须 ∈ `states`
- 每个 `states.*.src`（及可选 `preview`）文件必须存在
- `format` ∈ 支持列表（当前 `gif`）
- 与内置 id 冲突 → 拒绝；同 id 用户包 → 前端确认后覆盖
