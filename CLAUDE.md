# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# 开发（热更新）
npm run dev          # tauri dev = 启动 vite:dev + Rust 后端
npm run vite:dev     # 仅启动前端 Vite（无 Tauri，用于纯 UI 调试）

# 构建
npm run vite:build   # 仅构建前端到 dist/
cargo tauri build --debug   # 构建调试版 .exe（跳过安装包打包）
npm run build        # 完整 Tauri 生产构建（需要 WiX 工具链）

# 类型检查
npx vue-tsc --noEmit

# Rust 检查
cd src-tauri && cargo check
```

> **注意**：`package.json` 中 `build` = `tauri build`，`vite:build` = `vite build`。
> Tauri 的 `beforeBuildCommand` 调用 `vite:build` 以避免递归。

## 架构概览

### 状态机（核心）

所有 UI 状态由 `src/composables/useIslandState.ts` 管理，状态定义为：

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

### 组件职责

- **`Island.vue`**：状态机的唯一协调者。订阅 `onPhaseDoneCallback` 更新 island state；计算 CSS 形态类名；渲染右键上下文菜单和任务面板 popover。
- **`useIslandState.ts`**：状态 + 鼠标近距检测（`@vueuse/core useMouse`）+ 闲置检测（`useIdle`）+ Tauri `set_click_through` invoke。
- **`useTimer.ts`**：计时器纯逻辑，与 UI 解耦。`onPhaseDoneCallback` 注册回调，在 `Island.vue` 中监听并驱动状态转换。
- **`useTasks.ts`**：任务 CRUD，通过 `watch(tasks, save, { deep: true })` 自动持久化到 `$APPDATA/pomodoro-island/tasks.json`。

### Rust 后端（src-tauri/src/lib.rs）

仅暴露两个 Tauri command：
- `set_click_through(ignore: bool)` — 控制窗口鼠标穿透
- `get_window_position()` — 返回窗口物理坐标（前端用于计算近距离）

`setup` 钩子在启动时将窗口定位到屏幕顶部居中。

### TailwindCSS v4 注意事项

- 全局入口：`src/styles.css` 使用 `@import 'tailwindcss'`（无 `tailwind.config.js`）
- Vue `<style scoped>` 中使用 `@apply` 时，**必须**在块首加 `@reference "../styles.css";`
- CSS 变量定义在 `styles.css` 的 `:root` 中（`--focus-color`、`--break-color` 等），在模板中通过 `var(--xxx)` 引用
