# Frieren Pet

简易版桌宠框架，Tauri 2 + Vue 3 + TypeScript，架构参考 [BongoCat](https://github.com/ayangweb/BongoCat)。

- 透明 / 无边框 / 置顶 / 跳过任务栏的桌面窗口，按住拖动，Shift + 右键缩放（20–150%）
- 系统托盘常驻，关闭窗口仅隐藏；设置窗含 角色 / 商店 / 外观 / 关于 四页
- 配置持久化 + 跨窗口同步（Pinia + `@tauri-store/pinia`），记住窗口位置
- **多角色**：内置预设 + 用户导入 + 远程商店；`pet.json` 声明驱动状态机（GIF 渲染）
- 跨平台：macOS / Windows / Linux(X11)

## 快速开始

需要 Node 22 + pnpm 9 + Rust stable（完整流程见 [docs/setup.md](docs/setup.md)）：

```bash
git clone <repo> && cd <repo>
nvm use 22
corepack enable
pnpm install --frozen-lockfile
pnpm tauri dev        # 桌宠主窗口
pnpm dev              # 仅前端 Vite（无 Tauri API / 窗口）
```

验证环境：`pnpm typecheck`、`cargo check -p frieren-pet`。构建：`pnpm tauri build`。

## 文档

| 文档 | 内容 |
|------|------|
| [docs/setup.md](docs/setup.md) | 环境搭建：工具链 / 平台依赖 / 排障 |
| [docs/pet-format.md](docs/pet-format.md) | 角色格式：`pet.json` v1 / 意图与状态机 / 导入校验 |
| [docs/architecture.md](docs/architecture.md) | 架构：目录结构 / 设置与持久化 / 窗口行为 / 平台笔记 |
| [docs/release.md](docs/release.md) | 构建与 release workflow 对齐 |
| [docs/shop-api.md](docs/shop-api.md) | 商店后端接口契约 |
| [docs/roadmap.md](docs/roadmap.md) | 欠缺功能清单与优先级 |
