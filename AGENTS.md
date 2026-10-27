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
- **main 窗口**（灵动岛）：`App.vue` → `Island.vue`，屏幕顶部居中的小胶囊，置顶+透明+无边框，默认鼠标穿透
- **panel 窗口**（专注清单）：`PanelApp.vue`，从灵动岛弹出的面板，有打开/关闭动画

计时器逻辑运行在 panel 窗口（`useTimerBridge.ts`），在关键状态变化（阶段、运行状态、任务、时长）时通过 `emit('timer-state-update')` 广播快照（含 `syncedAt`）。main 窗口收到后用 `syncedAt + remaining` 推算结束时间，本地自行倒计时。main 窗口启动时会发 `timer-state-request` 拉取一次快照。

计时结束时 panel 设置 `pendingNotification` 并广播 `notification-show`，灵动岛显示通知横幅，用户操作通过 `notification-action`（confirm / extend / dismiss）回传 panel。

### 状态机

灵动岛 UI 状态由 `src/composables/useIslandState.ts` 管理，状态值来自 `timer-state-update`：

```
idle → focus / break（收到 running 的计时快照）
focus / break → idle（计时停止且无活动任务）
idle → alert（useIdle 5 分钟无操作；注意它只统计灵动岛窗口内的事件）
alert → 恢复（窗口内有鼠标/键盘活动）
```

`hide` 状态是遗留定义，目前没有代码进入该状态。`state`、`prevState` 以及 `useTimer` 的状态都是**模块级单例 ref**，同一窗口内所有组件共享；两个窗口各有一份独立实例。

### 持久化（`src/composables/persistence.ts`）

所有数据存放在 `$APPDATA/focus-island/`，统一通过 `createPersistedStore` 读写：
- 300ms 防抖，单文件串行写入，先写 `<file>.<窗口label>.tmp` 再 `rename`，保证原子性
- 读取或解析失败时先备份为 `<file>.corrupt-<时间戳>`；备份失败则本次会话禁止写入，避免覆盖原文件
- `restore()` 负责校验和迁移数据，数据不合法时应抛错；归一化后与文件内容不同会回写一次
- 传入 `syncEvent` 时，改动通过 `emitTo` 同步到另一个窗口；以"上次快照 JSON"判断是否需要写入，避免回写循环

| 文件 | composable | 跨窗口事件 |
|------|-----------|-----------|
| `settings.json` | `useSettings` | `settings-changed` |
| `tasks.json` | `useTasks` | `tasks-updated` |
| `task-groups.json` | `useTaskGroups` | `task-groups-updated` |
| `memos.json` / `memo-categories.json` | `useMemos` | `memos-updated` / `memo-categories-updated` |
| `daily-stats.json` | `useDailyStats` | — |
| `achievements.json` | `useAchievements` | — |
| `radio.json` | `useRadio` | —（播放状态另由 `radio-state-update` 广播） |

新增持久化数据时请复用 `createPersistedStore`，不要直接调用 `writeTextFile`。

### Composables 职责

- **`useIslandState.ts`**：灵动岛状态 + 闲置检测（`@vueuse/core useIdle`）
- **`useTimer.ts`**：计时器纯逻辑，与 UI 解耦，以 `phaseEndAtMs` 计算剩余时间。`onPhaseDoneCallback` 注册阶段结束回调；提供 `skipToBreak()`、`abandon()` 和通知相关的 `confirm/extend/dismissNotification()`
- **`useTimerBridge.ts`**：panel 窗口专用，包装 useTimer，负责广播状态、记录番茄（任务、每日统计、成就）以及处理通知操作
- **`useTasks.ts`**：任务 CRUD。任务按 `dueDate`（本地日期 `YYYY-MM-DD`，分为 overdue/today/tomorrow/week/later/nodate）、`groupId` 和 `priority`（0=收件箱，1-3=核心专注区排名）组织
- **`useSettings.ts`**：主题、时长、透明度、缩放、显示模式（常驻/边缘停靠）、`idleMottos`、快捷键、开机自启等
- **`useDockMode.ts`**：边缘停靠模式，轮询 `is_mouse_over_window` 决定展开或收起细条
- **`useDailyStats.ts` / `useAchievements.ts`**：每日统计与成就，日期一律用 `src/utils/date.ts` 的本地日期
- **`useShortcut.ts`**：全局快捷键，只在 `Pressed` 时切换面板

### Panel 页面路由

`PanelApp.vue` 通过 `currentView` ref 切换视图：`tasks`（TaskArea）、`todo`（TodoPage）、`taskDetail`（TaskDetailPage）、`settings`、`memos`、`stats`、`radio`。

### Rust 后端（src-tauri/src/lib.rs）

前端会调用的 Tauri commands：
- `is_mouse_over_window(pad)` — 鼠标是否在当前窗口内（macOS: CoreGraphics, Windows: Win32, Linux: X11）
- `set_click_through(ignore)` — 窗口鼠标穿透
- `set_island_size(scale)` / `set_island_custom_size(width, height)` — 调整灵动岛窗口尺寸并水平居中
- `toggle_panel` / `animate_panel_close` / `hide_panel` / `is_panel_visible` / `position_panel_under_island` / `get_panel_transition_metrics` / `emit_island_panel_motion` — panel 显示与动画。Rust 端只负责定位、显示，并发出 `panel-window-transition` 事件，动画由前端完成
- `get_update_proxy` / `get_macos_update_health` — 更新时的代理探测与 macOS quarantine 检测
- `get_local_audio_path` — 本地音频资源路径

系统托盘菜单提供"打开专注清单"、"显示/隐藏灵动岛"、"退出"。

### 安全

- `tauri.conf.json` 配置了 CSP（`csp` / `devCsp`）：脚本只允许同源；`style-src` 关闭了 Tauri 的 nonce 注入，以便内联样式生效。新增外部资源（图片、音频、接口）时需要同步调整 CSP
- 写入 `innerHTML` 的富文本一律先经过 `src/utils/sanitizeHtml.ts`（DOMPurify）

### 跨平台

- macOS: `core-graphics` crate（鼠标位置），`macos-private-api`（透明窗口）
- Windows: `windows` crate（Win32 GetCursorPos、WinInet 系统代理）
- Linux: `x11` crate（XQueryPointer），需要 X11 compositor 支持透明

### TailwindCSS v4 注意事项

- 全局入口：`src/styles.css` 使用 `@import 'tailwindcss'`（无 `tailwind.config.js`）
- Vue `<style scoped>` 中使用 `@apply` 时，**必须**在块首加 `@reference "../styles.css";`
- CSS 变量定义在 `styles.css` 的 `:root` 中（`--focus-color`、`--break-color`、`--idle-color`、`--alert-color`），运行时由 `useSettings.ts` 的 `applyThemeToDOM()` 动态设置
