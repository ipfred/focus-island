# Pomodoro Island 双窗口分离方案实施计划

## 用户需求确认
- **灵动岛窗口（main）**：纯展示，显示当前任务状态和番茄进度。透明、无边框、始终置顶、始终 click-through。
- **专注清单窗口（panel）**：三栏布局，自定义标题栏（深色毛玻璃风），含完整任务管理功能。
- **计时器主导方**：panel 前端主导，通过 Tauri 2.x 事件广播状态到灵动岛。
- **系统托盘**：支持显示/隐藏专注清单、退出。

## Panel 窗口布局（三栏）
```
[左侧 180px] 分类/标签侧边栏
  - 今天 / 明天 / 本周
  - 自定义标签（预留）

[中间 flex-1] 主任务区
  - 顶部：统计信息（今日专注番茄数、专注时长）
  - 新增任务输入框
  - 任务列表：每行有启动番茄钟按钮、完成勾选、点击展开右侧详情

[右侧 280px] 任务详情面板（点击任务时展开）
  - 任务标题（可编辑）
  - 备注/描述（多行文本）
  - 子任务列表（可选）
  - 番茄历史记录
```

---

## 改动范围

### 1. `src-tauri/tauri.conf.json`
- 新增 `panel` 窗口配置（600x720px，decorations: false，transparent: true，初始隐藏 visible: false，skipTaskbar: false）
- main 窗口保持不变

### 2. `src-tauri/capabilities/default.json`
- windows 列表加入 `panel`

### 3. `src-tauri/src/lib.rs`
新增/修改内容：
- **`toggle_panel` 命令**：显示/隐藏 panel 窗口
- **`show_panel` 命令**：打开 panel 窗口（居中定位）
- **`set_island_visible` 命令**：显示/隐藏灵动岛窗口
- **系统托盘菜单**：在 setup 中用 `tauri::tray::TrayIconBuilder` 构建
  - 「打开专注清单」→ show_panel
  - 「显示/隐藏灵动岛」→ toggle island
  - 分隔线
  - 「退出」→ app.exit(0)
- setup 中定位 main 窗口（保留现有逻辑）；panel 窗口居中定位

### 4. `src/App.vue`
- 根据 `getCurrentWebviewWindow().label` 判断当前窗口
- main 窗口：渲染 `<Island>`（现有）
- panel 窗口：渲染 `<PanelApp>`（新建）

### 5. `src/main.ts`
- 无需修改（App.vue 内部路由即可）

### 6. 灵动岛窗口改造（`src/components/Island.vue`）
**大幅简化**：
- 移除右键菜单（`onRightClick`、`ctxMenu` 相关）
- 移除任务列表 popover（`showTasks`、`<TaskList>` 相关）
- 移除 `useTasks` 引用
- 保留：进度边框、CapsuleIdle/CapsuleFocus/LineHide 渲染、状态机
- **新增**：监听来自 panel 的 Tauri 事件（`timer-state-update`）更新本地状态
- **始终 click-through**：在 `lib.rs` setup 时对 main 窗口直接调用 `set_ignore_cursor_events(true)`
- **简化 useIslandState**：移除 `setInteracting`（不再需要），保留鼠标接近检测（hide 状态用于美观）

### 7. 跨窗口通信方案
使用 Tauri 2.x `@tauri-apps/api/event` 的 `emit` + `listen`：

**Panel → Island（状态广播，每秒）**
```typescript
emit('timer-state-update', {
  phase: 'focus' | 'break',
  remaining: number,
  running: boolean,
  activeTaskId: string | null,
  activeTaskTitle: string | null,
})
```

**Island 端监听**
```typescript
listen('timer-state-update', (event) => {
  syncTimerState(event.payload)
})
```

**Panel → Island（岛屿显示控制）**
```typescript
emit('island-visibility', { visible: boolean })
```

### 8. 新增文件列表
```
src/
  components/
    panel/
      PanelApp.vue          # Panel 根组件（自定义标题栏 + 三栏布局）
      PanelSidebar.vue      # 左侧分类侧边栏（今天/明天/本周）
      PanelMain.vue         # 中间任务区（统计+列表+新增）
      PanelTaskDetail.vue   # 右侧任务详情抽屉
      PanelTaskRow.vue      # 任务行组件（含启动按钮）
      PanelHeader.vue       # 自定义标题栏（拖拽、关闭/最小化）
      PanelTimer.vue        # 中间区顶部计时器显示（当前任务+倒计时）
  composables/
    usePanelTimer.ts        # Panel 侧计时器（持有 setInterval，广播事件）
    useIslandSync.ts        # Island 侧事件监听（接收 timer-state-update）
```

### 9. `useTasks.ts` 改造
- Task 接口新增可选字段：
  - `note?: string`（备注）
  - `dueDate?: 'today' | 'tomorrow' | 'week' | null`（分类）
  - `subtasks?: { id: string; title: string; done: boolean }[]`（子任务，预留）
- 新增 `filterByDate` 计算属性

---

## 实施步骤（按顺序）

### Step 1：Tauri 配置（后端）
- [ ] 修改 `tauri.conf.json`：添加 panel 窗口
- [ ] 修改 `capabilities/default.json`：windows 加入 `panel`
- [ ] 修改 `lib.rs`：添加 toggle_panel/show_panel/set_island_visible 命令 + 托盘菜单

### Step 2：App.vue 窗口路由
- [ ] 修改 `App.vue`：根据当前窗口 label 渲染不同根组件

### Step 3：灵动岛简化
- [ ] 简化 `Island.vue`：移除右键菜单和任务列表
- [ ] 新建 `useIslandSync.ts`：监听 timer-state-update 事件
- [ ] 修改 `lib.rs`：main 窗口启动时设置始终 click-through

### Step 4：Panel 核心框架
- [ ] 新建 `PanelApp.vue`（根组件 + 三栏布局骨架）
- [ ] 新建 `PanelHeader.vue`（自定义标题栏，含 data-tauri-drag-region）
- [ ] 新建 `PanelSidebar.vue`（分类侧边栏）

### Step 5：Panel 任务功能
- [ ] 新建 `PanelMain.vue`（统计 + 新增输入 + 任务列表）
- [ ] 新建 `PanelTaskRow.vue`（任务行）
- [ ] 新建 `PanelTaskDetail.vue`（右侧详情）
- [ ] 扩展 `useTasks.ts`（note/dueDate 字段）

### Step 6：跨窗口计时器
- [ ] 新建 `usePanelTimer.ts`（计时器逻辑 + 每秒 emit 事件）
- [ ] 新建 `PanelTimer.vue`（接入 usePanelTimer）
- [ ] `useIslandSync.ts` 接收并驱动灵动岛显示

### Step 7：收尾
- [ ] 托盘菜单联调
- [ ] panel 窗口的岛屿显示开关联调
- [ ] 样式统一（深色毛玻璃，与灵动岛一致）
- [ ] 测试：启动番茄 → 灵动岛同步显示 → 完成 → panel 统计更新

---

## 技术要点

### Tauri 2.x 事件 API
```typescript
import { emit, listen } from '@tauri-apps/api/event'
// emit 是全局广播，两个窗口都能收到
```

### 当前窗口识别
```typescript
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
const label = getCurrentWebviewWindow().label // 'main' | 'panel'
```

### 自定义标题栏拖拽
```html
<div data-tauri-drag-region class="titlebar">...</div>
```
需在 `tauri.conf.json` 中 panel 窗口设置 `decorations: false`

### 始终 click-through（灵动岛）
在 `lib.rs` setup 中对 main 窗口直接调用 `set_ignore_cursor_events(true)`，无需前端动态控制

---

## 不改动的内容
- `CapsuleIdle.vue`、`CapsuleFocus.vue`、`LineHide.vue`（灵动岛显示组件保留）
- `styles.css`（全局样式共享）
- `useTasks.ts` 核心逻辑（只新增字段）

---

## 预期文件变更汇总

| 文件 | 操作 |
|------|------|
| `src-tauri/tauri.conf.json` | 修改（加 panel 窗口） |
| `src-tauri/capabilities/default.json` | 修改（加 panel） |
| `src-tauri/src/lib.rs` | 修改（托盘+新命令） |
| `src/App.vue` | 修改（窗口路由） |
| `src/components/Island.vue` | 修改（简化） |
| `src/composables/useTasks.ts` | 修改（加字段） |
| `src/composables/useIslandSync.ts` | 新建 |
| `src/composables/usePanelTimer.ts` | 新建 |
| `src/components/panel/PanelApp.vue` | 新建 |
| `src/components/panel/PanelHeader.vue` | 新建 |
| `src/components/panel/PanelSidebar.vue` | 新建 |
| `src/components/panel/PanelMain.vue` | 新建 |
| `src/components/panel/PanelTaskRow.vue` | 新建 |
| `src/components/panel/PanelTaskDetail.vue` | 新建 |
| `src/components/panel/PanelTimer.vue` | 新建 |
