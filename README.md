# 🍅 Pomodoro Island

> 桌面端最轻量的番茄钟 —— 以「灵动岛」形态常驻屏幕顶部，专注时在，需要时隐。

![Version](https://img.shields.io/badge/version-0.1.0-orange) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## 概述

Pomodoro Island 是一个基于 [Tauri 2](https://tauri.app/) 构建的桌面悬浮窗应用，将番茄工作法（Pomodoro Technique）与 Apple Dynamic Island 的交互理念结合，以一条贴在屏幕顶部的「胶囊」形式存在，最小化对工作流的干扰。

## 功能特性

### 五种 UI 状态

| 状态 | 描述 | 触发条件 |
|------|------|----------|
| **待机态 (Idle)** | 轮播展示最多 3 个待办任务，每 10 秒切换 | 默认状态 |
| **专注态 (Focus)** | 显示当前任务名 + SVG 进度圆环 + 倒计时 | 点击任务后进入 |
| **休息态 (Break)** | 绿色圆环 + 休息倒计时 | 专注结束后自动切换 |
| **隐匿态 (Hide)** | 收缩为 2px 细线，开启鼠标穿透 | 鼠标靠近 200px 内 |
| **警示态 (Alert)** | 橙色脉冲边框 + 提醒文字 | 专注中超过 5 分钟无操作 |

### 核心功能

- **任务管理**：添加、完成、删除任务；每个任务记录已完成的番茄钟次数（●●● 显示）
- **番茄时钟**：25 分钟专注 / 5 分钟休息循环
- **智能闪避**：鼠标靠近自动缩为细线 + 穿透，移开后恢复（200px 隐藏 / 320px 恢复，带滞回）
- **右键控制菜单**：随时暂停、继续、跳过休息、放弃当前番茄
- **闲置检测**：通过 `@vueuse/core useIdle` 检测，5 分钟无操作切换为警示态
- **数据持久化**：任务数据以 JSON 格式存储于系统 `AppData` 目录

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | [Tauri 2](https://tauri.app/) (Rust + WebView2) |
| 前端框架 | [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) |
| 构建工具 | [Vite 6](https://vitejs.dev/) |
| 样式 | [TailwindCSS v4](https://tailwindcss.com/) |
| 工具库 | [@vueuse/core](https://vueuse.org/) · [@vueuse/motion](https://motion.vueuse.org/) |
| 存储 | tauri-plugin-fs（JSON 文件） |

## 项目结构

```
pomodoro-island/
├── src/                          # Vue 前端源码
│   ├── main.ts                   # 应用入口
│   ├── App.vue                   # 根组件（挂载 Island + 近距检测）
│   ├── styles.css                # 全局样式 + CSS 变量
│   ├── components/
│   │   ├── Island.vue            # 状态机核心，右键菜单，任务面板
│   │   ├── CapsuleIdle.vue       # 待机态：任务轮播
│   │   ├── CapsuleFocus.vue      # 专注/休息态：进度圆环 + 倒计时
│   │   ├── LineHide.vue          # 隐匿态：进度细线
│   │   └── TaskList.vue          # 任务增删改查面板
│   └── composables/
│       ├── useIslandState.ts     # 状态机 + 鼠标近距检测
│       ├── useTimer.ts           # 番茄钟计时逻辑
│       └── useTasks.ts           # 任务数据管理 + 持久化
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs               # 程序入口
│   │   └── lib.rs                # Tauri 命令：set_click_through, get_window_position
│   ├── tauri.conf.json           # 窗口配置（无边框/透明/置顶）
│   ├── Cargo.toml
│   ├── build.rs
│   └── icons/                    # 应用图标
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) 1.80+
- Windows: [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)（Windows 11 已内置）
- macOS: Xcode Command Line Tools

### 安装依赖

```bash
npm install
```

### 开发模式（热更新）

```bash
npm run dev
```

### 仅运行前端预览

```bash
npm run vite:dev
```

### 构建调试版

```bash
cargo tauri build --debug
# 产物：src-tauri/target/debug/pomodoro-island.exe
```

### 构建发布版

```bash
npm run build
# 产物：src-tauri/target/release/bundle/
```

> **注意（Windows）**：发布版构建需要 [WiX Toolset v3](https://wixtoolset.org/) 生成 MSI 安装包。如仅需 `.exe`，使用调试版即可。

## 交互说明

### 启动任务
单击灵动岛展开的任务列表中的任何一项，立即进入 **专注态**，计时开始。

### 控制番茄钟
右键单击灵动岛（包括隐匿态的细线）弹出控制菜单：

| 菜单项 | 说明 |
|--------|------|
| 暂停 / 继续 | 暂停或恢复当前番茄钟 |
| 跳过休息 | 提前结束休息，开始下一个番茄 |
| 结束休息 | 同上 |
| 放弃番茄 | 终止当前记录，回到待机态 |

### 任务管理
右键菜单中点击 **任务列表** 打开任务面板，支持添加（回车确认）、勾选完成、删除。

### 闪避机制
- 鼠标进入窗口 **200px** 范围 → 自动收缩为 2px 细线 + 开启穿透
- 鼠标移出 **320px** 范围 → 恢复原始形态（滞回设计防止抖动）

## 数据存储

任务数据存储路径：

```
Windows: %APPDATA%\pomodoro-island\tasks.json
macOS:   ~/Library/Application Support/pomodoro-island/tasks.json
```

## 路线图

- [x] v0.1 — 核心番茄钟循环 + 5 种 UI 状态
- [ ] v0.5 — 全局快捷键（Alt+P 暂停，Alt+S 跳过）
- [ ] v0.5 — 系统托盘图标
- [ ] v0.5 — 呼吸动画（每 15/30 分钟温柔提醒）
- [ ] v1.0 — 统计面板（日/周番茄数图表）
- [ ] v1.0 — 自定义时长设置
- [ ] v1.0 — macOS 正式适配

## License

MIT
