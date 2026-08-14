# Roadmap

当前已实现：GIF 渲染状态机、多角色（预设 / 导入 / 商店）、托盘与关窗隐藏、设置持久化与跨窗同步、公告轮询与横幅、**应用内自动更新**、**开机自启**、**商店角色版本更新检测**、GitHub 更新检查。

以下为「完整应用」视角下的欠缺功能，按优先级分组。标注「架构备注」的项与 [docs/architecture.md](architecture.md) 的「后续可扩展」一致。

## 高优先级（核心体验 / 发布）

- **代码签名 / 公证**：无 macOS notarization、Windows 代码签名。自动更新在 macOS 上受 Gatekeeper 拦截，需配置 Apple 证书后由 CI 签名/公证
- **更多渲染后端**：仅 `gif`（`src/renderers/createRenderer.ts`），缺序列帧 / Live2D / 透明视频（架构备注）

## 中优先级（桌宠特色 / 设置）

- **全局输入驱动**：无 `rdev` / `gilrs`（BongoCat 的键鼠 / 手柄驱动动作），也无需任何全局快捷键
- **跟随光标 / 随机游走**：桌宠只能原地响应意图，无桌面游走类行为（架构备注）
- **每角色独立 scale / 位置**：当前为全局单一 `scale` / `x` / `y`；需在 store 初值预留嵌套结构（架构备注）
- **托盘 / 右键快速切角**：托盘菜单仅 设置 / 商店 / 显示 / 退出（`src-tauri/src/setup/mod.rs`），无快速切换角色（架构备注）
- **本地导入支持 zip**：`PetsTab.handleImport` 仅支持选择目录（`open({ directory: true })`），不能直接选 zip 文件

## 低优先级（生态 / 工程）

- **商店筛选**：`catalog.items[].tags` 已预留但未用于分页 / 搜索 / 分类
- **后端服务**：本仓库只有接口契约（[docs/shop-api.md](shop-api.md)）+ dev mock 回退，无服务端实现
- **前端工程质量**：无测试套件 / ESLint / Prettier，仅 `vue-tsc --noEmit` 类型检查
- **i18n**：UI 文案硬编码中文
- **运维**：无崩溃上报 / 日志 / 设置与角色备份导出
