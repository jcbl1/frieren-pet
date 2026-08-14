# 商店接口设计

远程角色商店（`feat/shop-remote-store`）客户端契约。后端按本文档实现即可与客户端对接。

## 概述

商店 Tab 从远程服务器拉取可获取的角色清单，用户点击「安装」后由 Rust 侧下载、解压、校验并入库，与本地「导入角色」走同一套校验与存储逻辑。

```
商店 Tab
  ├─ loadShopCatalog()  ── invoke ──> fetch_shop_catalog  ── GET {base}/catalog
  └─ 点击「安装」 ─────── invoke ──> install_pet_from_url ── GET {downloadUrl}（zip）
                                       → 解压 → 校验 → appDataDir/pets/<id>/

公告推送（方案 A：轮询）
  └─ pollAndPushNotices() ── invoke ──> fetch_notices ──── GET {base}/notices（启动后 10s + 每 30min）
                                       → 新公告 → pushNotice() → 原生通知 + 设置窗口横幅 + 详情弹窗
```

- 前端 `SHOP_API_BASE` 常量：`src/services/petShop.ts`，读取 `VITE_SHOP_API_BASE`（Vite 环境变量，见下「环境配置」）
- 后端不可达或解析失败时，**仅 dev** 自动 fallback 到内置 mock 清单（`petShop.ts` 中的 `MOCK_CATALOG`）；prod 直接报错
- 所有请求由 Rust `reqwest` 发起，**无 CORS 限制**，后端只需提供可匿名访问的 HTTPS 直链

### 环境配置（dev / prod 不同后端）

| 环境 | 文件 | 值 |
|------|------|-----|
| dev（`pnpm tauri dev`） | `.env.development` | `VITE_SHOP_API_BASE=http://localhost:8000`（本地直连） |
| prod（`pnpm tauri build`） | `.env.production` | `VITE_SHOP_API_BASE=https://shop.example.com`（反代入口） |

`import.meta.env.DEV` 由 Vite 构建模式驱动：dev = `vite`，prod = `vite build`。本地私密覆盖可写 `.env.local`（已 gitignore）。

## 字段命名

JSON 一律使用 **camelCase**（与 Rust `serde(rename_all = "camelCase")` 对齐）。

## 接口 1：获取角色清单

```
GET {base}/catalog
```

### 响应

`200 OK`

```json
{
  "items": [
    {
      "id": "fern",
      "name": "Fern",
      "description": "Frieren 的弟子，认真可靠的小魔法使",
      "author": "frieren-pet",
      "version": "1.0.0",
      "size": 2048000,
      "previewUrl": "https://cdn.example.com/pets/fern.png",
      "downloadUrl": "https://cdn.example.com/pets/fern.zip",
      "tags": ["anime", "gif"]
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `items` | `array` | 是 | 角色列表，可为空数组 |
| `items[].id` | `string` | 是 | 角色 id，须匹配 `/^[a-z0-9][a-z0-9_-]{0,63}$/i`，且不得与内置 preset 冲突 |
| `items[].name` | `string` | 是 | 显示名称 |
| `items[].description` | `string` | 是 | 卡片简介 |
| `items[].author` | `string` | 是 | 作者/来源 |
| `items[].version` | `string` | 是 | 版本号（UI 展示用） |
| `items[].size` | `number` | 否 | zip 体积，字节 |
| `items[].previewUrl` | `string` | 是 | 卡片缩略图直链（可匿名访问） |
| `items[].downloadUrl` | `string` | 是 | 角色包 zip 直链 |
| `items[].tags` | `array<string>` | 否 | 预留，暂未用于筛选 |

### 错误

非 `2xx` 或响应体无法按上述结构解析 → 客户端报错并显示「商店目录获取失败」。

## 接口 2：获取公告列表（服务端推送）

客户端以**轮询**方式拉取服务端下发的公告/活动/更新说明。轮询周期 30 分钟，启动后 10s 首次拉取；仅在「自动检查更新」开启时执行。

```
GET {base}/notices
```

### 响应

`200 OK`

```json
{
  "items": [
    {
      "id": "activity-summer-2026",
      "kind": "activity",
      "title": "夏日限时活动",
      "subtitle": "活动说明",
      "body": "即日起至 8 月底，安装任意商店角色可解锁隐藏彩蛋。",
      "publishedAt": "2026-08-14T00:00:00Z",
      "actions": [
        { "label": "去商店看看", "kind": "open-url", "url": "https://shop.example.com" }
      ]
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `items` | `array` | 是 | 公告列表，可为空数组 |
| `items[].id` | `string` | 是 | 公告唯一 id；客户端以它去重，重复返回同一 id 不会重复提醒 |
| `items[].kind` | `string` | 是 | 类型：`update`（版本更新）/ `announcement`（公告）/ `activity`（活动） |
| `items[].title` | `string` | 是 | 标题（原生通知标题、横幅主标题） |
| `items[].subtitle` | `string` | 否 | 副标题（横幅副标题、详情弹窗角标文案） |
| `items[].body` | `string` | 是 | 正文，详情弹窗以 `pre-wrap` 渲染（换行/`- ` 列表可用） |
| `items[].publishedAt` | `string` | 否 | ISO 8601 时间，详情弹窗展示 |
| `items[].actions` | `array` | 否 | 详情弹窗底部动作按钮，可为空数组 |
| `items[].actions[].label` | `string` | 是 | 按钮文案 |
| `items[].actions[].kind` | `string` | 是 | `open-url`（默认浏览器打开 `url`）/ `download`（应用内下载并打开 `url`） |
| `items[].actions[].url` | `string` | 依赖 kind | `open-url` / `download` 必填 |

### 客户端行为

- 公告**默认始终拉取**，不受「自动检查更新」开关影响（该开关只管 GitHub 版本检查）
- 队列逐个展示：新公告进入 `pendingNotices` 队列，设置窗口横幅每次显示队头；点击横幅 → 弹详情并推进到下一条
- 原生通知**合并为一条**：同一轮拉取多条新公告只发一条（如「N 条新公告」），不逐条刷屏
- **「系统推送」开关**只控制系统通知（`systemNotifications`，默认开启）：关闭后不再发送原生通知、也不申请权限；应用内横幅与详情弹窗不受影响
- 会话级关闭：点横幅「×」后该 `id` 加入 `dismissedNoticeIds`，**本次应用运行期间**不再展示；重启应用后若该公告仍被服务端返回则再次出现（`notifiedNoticeIds` / `dismissedNoticeIds` 于启动时清空）
- 同一轮次内去重：`notifiedNoticeIds` 防止重复轮询对同一 `id` 重复提醒
- 拉取失败：**仅 dev** 静默跳过；prod 记录错误，不中断应用

### 错误

非 `2xx` 或响应体无法按上述结构解析 → 客户端跳过本轮拉取。

## 接口 3：下载并安装角色

非 HTTP 接口，由前端将 `downloadUrl` 传给 Tauri 命令：

```
invoke('install_pet_from_url', { url: <downloadUrl> })
```

### 流程

1. `GET {downloadUrl}`，非 `2xx` → 报错
2. 下载到内存 → 解压到临时目录（`zip` crate，`enclosed_name` 拒绝 `../`、绝对路径等越界条目）
3. 定位包根：zip 根目录内含 `pet.json`，或**唯一**顶层子目录内含 `pet.json`（两种布局均兼容）
4. 复用本地导入校验：必填字段、`defaultState` / `capabilities.*` / `states.*.next` 指向、媒体文件存在、`format ∈ {gif}`、与内置 preset id 冲突拒绝
5. 复制到 `{appDataDir}/pets/<id>/`（同 id 用户包直接覆盖）
6. 清理临时目录

### 返回

成功：安装后的 `pet.json`（含注入的 `resourceDir`，指向 `appDataDir/pets/<id>`）。

失败：错误字符串（下载失败 / 状态码异常 / 解压失败 / 校验失败）。

## 角色包（zip）规范

zip 内容与本地「导入角色」目录同构：

```
fern.zip
├── pet.json        # v1 协议，见 README「pet.json（v1）」
├── idle.gif
├── sleep.gif
└── preview.png     # 可选
```

## 后端对接清单

- 提供 `GET /catalog`，返回上述结构
- 提供 `GET /notices`，返回公告列表（可为空数组）
- 提供 `items[].previewUrl` / `items[].downloadUrl` 可匿名访问的 HTTPS 直链
- zip 按「角色包规范」打包
- dev 起本地服务（默认 `localhost:8000`）；prod 在反代层将 `/catalog`、`/notices` 与 zip 直链转发到后端，无需配 CORS
- 改 `.env.development` / `.env.production` 的 `VITE_SHOP_API_BASE` 指向实际地址 → `pnpm tauri dev` → 商店 Tab 显示真实清单 → 安装验证

## 后续可扩展（当前未实现）

- 分页 / 搜索 / 分类（`tags` 已预留字段位）
- 版本更新检测：以 `version` 对比已装角色的 `pet.json.version`（当前协议无版本字段，需先扩展 `pet.json`）
