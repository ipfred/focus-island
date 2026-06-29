# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
# 开发（热更新）
npm run dev          # tauri dev = 启动 vite:dev + Rust 后端
npm run vite:dev     # 仅启动前端 Vite（无 Tauri，用于纯 UI 调试）

# 构建
npm run vite:build   # 仅构建前端到 dist/
cargo tauri build --debug   # 构建调试版（跳过安装包打包）
npm run build        # 完整 Tauri 生产构建

# 类型检查
npx vue-tsc --noEmit

# Rust 检查
cd src-tauri && cargo check
```

> **注意**：`package.json` 中 `build` = `tauri build`，`vite:build` = `vite build`。
> Tauri 的 `beforeBuildCommand` 调用 `vite:build` 以避免递归。

## 架构概览

### 双窗口架构

应用由两个 Tauri 窗口组成，通过事件通信：
- **main 窗口**（灵动岛）：`App.vue` → `Island.vue`，屏幕顶部居中的小胶囊，置顶+透明+无边框
- **panel 窗口**（专注清单）：`PanelApp.vue`，从灵动岛弹出的任务管理面板，有打开/关闭动画

计时器逻辑运行在 panel 窗口（`useTimerBridge.ts`），每 500ms 通过 `emit('timer-state-update')` 广播状态到 main 窗口。main 窗口通过 `listen('timer-state-update')` 接收并驱动灵动岛 UI。

### 状态机（核心）

所有灵动岛 UI 状态由 `src/composables/useIslandState.ts` 管理：

```
idle → focus（点击任务）
focus → hide（鼠标靠近 <200px）
hide → idle/focus（鼠标移开 >320px，带滞回）
focus → break（计时器归零，由 Island.vue 的 onPhaseDoneCallback 触发）
break → idle（休息计时器归零）
focus/idle → alert（useIdle 检测 5 分钟无操作）
alert → 恢复（任意鼠标/键盘活动）
```

`state` 和 `prevState` 是**模块级单例 ref**（文件顶层声明，非函数内），所有组件共享同一实例。`useTimer` 同理。

### Composables 职责

- **`useIslandState.ts`**：状态 + 鼠标近距检测（`@vueuse/core useMouse`）+ 闲置检测（`useIdle`）+ Tauri `set_click_through` invoke
- **`useTimer.ts`**：计时器纯逻辑，与 UI 解耦。`onPhaseDoneCallback` 注册回调。提供 `skipToBreak()`（提前进入休息）和 `abandon()`（停止计时）
- **`useTimerBridge.ts`**：panel 窗口专用，包装 useTimer 并广播状态到灵动岛窗口
- **`useTasks.ts`**：任务 CRUD，通过 `watch(tasks, save, { deep: true })` 自动持久化到 `$APPDATA/pomodoro-island/tasks.json`。任务按 `category`（today/tomorrow/week）和 `priority`（0=收件箱, 1-3=核心专注区排名）组织
- **`useSettings.ts`**：设置持久化到 `$APPDATA/pomodoro-island/settings.json`，包含主题、时长、透明度、`idleMottos`（空闲激励语）

### Panel 页面路由

`PanelApp.vue` 通过 `currentView` ref 切换三个视图：`tasks`（TaskArea）、`settings`（SettingsPage）、`completed`（CompletedPage），使用 `<transition>` 动画。

### Rust 后端（src-tauri/src/lib.rs）

主要 Tauri commands：
- `get_mouse_position()` — 跨平台鼠标坐标（macOS: CoreGraphics, Windows: Win32, Linux: X11）
- `set_click_through(ignore)` — 窗口鼠标穿透
- `set_island_height(height)` — 动态调整灵动岛窗口高度
- `animate_panel_open/close` — panel 窗口弹出/收起动画（Rust 线程中逐帧插值）
- `toggle_panel` / `show_panel` / `hide_panel` — panel 显示控制

系统托盘菜单提供"打开专注清单"、"显示/隐藏灵动岛"、"退出"。

### 跨平台

- macOS: `core-graphics` crate（鼠标位置），`macos-private-api`（透明窗口）
- Windows: `windows` crate（Win32 GetCursorPos）
- Linux: `x11` crate（XQueryPointer），需要 X11 compositor 支持透明

### TailwindCSS v4 注意事项

- 全局入口：`src/styles.css` 使用 `@import 'tailwindcss'`（无 `tailwind.config.js`）
- Vue `<style scoped>` 中使用 `@apply` 时，**必须**在块首加 `@reference "../styles.css";`
- CSS 变量定义在 `styles.css` 的 `:root` 中（`--focus-color`、`--break-color`、`--idle-color`、`--alert-color`），运行时由 `useSettings.ts` 的 `applyThemeToDOM()` 动态设置
