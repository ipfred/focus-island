# 番茄钟完成通知悬浮窗

**日期**: 2026-05-14
**状态**: 设计完成，待实现

---

## 概述

番茄钟倒计时归零时，在灵动岛窗口上方弹出通知悬浮窗，用户必须手动点击按钮选择后续操作，不再自动跳转下一阶段。支持设置中配置通知提示音。

---

## 视觉设计

参考 iOS 通知横幅风格，方案 A — 超紧凑胶囊式：

- `width`: 约 316px（与灵动岛宽度一致，受 `islandScale` 缩放）
- `border-radius`: 24px（强胶囊感）
- `height`: 约 60px（单行为主，副标题小字）
- 背景: 深色半透明毛玻璃 `rgba(30,30,36,0.96)` + `backdrop-filter: blur(20px)`
- 左侧: 36px 圆形图标（表情符号或 SVG），颜色跟随阶段（focus→橙, break→绿）
- 中间: 主标题 12.5px/600 + 副标题 10.5px/48%透明度
- 右侧: 两颗药丸按钮，主按钮填充色、次按钮描边半透明
- 入场动画: `scale(0.85→1)` + `opacity(0→1)`, 300ms ease-out
- 无自动消失，必须手动点击按钮

### 两类通知

| 阶段 | 图标 | 主标题 | 副标题 | 主按钮 | 次按钮 | 主题色 |
|---|---|---|---|---|---|---|
| focus 完成 | ✅ 勾选 | 完成了一个番茄 | 休息一下吧 | 休息 | 退出 | `--focus-color` (橙) |
| break 完成 | ⏰ 时钟 | 休息结束 | 准备开启下一个番茄钟吗 | 继续 | 退出 | `--break-color` (绿) |

---

## 架构与数据流

### 新增组件

**`src/components/ToastNotification.vue`**
- Props: `phase` (focus/break), `taskTitle` (string|null)
- Emits: `action` → `'start-break' | 'abandon-focus' | 'continue-focus' | 'abandon-break'`
- 纯展示组件，不包含业务逻辑

### 跨窗口事件（Tauri events）

```
panel → island:  "phase-completed"
  payload: { phase: TimerPhase, taskId: string|null, taskTitle: string|null }

island → panel:  "notification-action"
  payload: { action: "start-break" | "abandon-focus" | "continue-focus" | "abandon-break", taskId: string|null }
```

### 计时器行为变更

**`useTimer.ts` — `onPhaseDone()`**：
- 不再自动跳转阶段
- 改为：停止计时 → 设置 `running = false` → 触发 `onDoneCallbacks`（保持现有回调机制，callback 参数中包含 phase 信息）
- 新增方法：
  - `startBreak()` — 启动休息计时
  - `continueFocus()` — 继续同任务开始新番茄钟
  - `abandonWithCount()` — 放弃任务但保留计数

**`useTimerBridge.ts`**：
- 在 `onPhaseDoneCallback` 中发射 `"phase-completed"` 事件到 island 窗口（替代原自动跳转逻辑）
- 新增监听 `"notification-action"` 事件，根据 action 调用 timer 对应方法

**`Island.vue`**：
- 新增 `listen("phase-completed")`，显示 ToastNotification
- ToastNotification 的 `@action` 事件触发时，`emit("notification-action")` 到 panel 窗口

### 状态管理

通知可见性用 `Island.vue` 内的局部 `ref<boolean>` + `ref<TimerPhase>`，不放入全局 composable。通知期间灵动岛 state 保持当前状态不变。

---

## 设置扩展

**`useSettings.ts`**：
- 新增字段 `notificationSound: boolean`，默认 `true`
- 持久化到 `settings.json`

**`SettingsPage.vue`**：
- 新增「通知提示音」开关

**音效实现**：
- 使用 Web Audio API (`AudioContext` + `OscillatorNode`) 生成简短提示音
- 音效仅在 `notificationSound === true` 且通知弹出时播放
- 在 `Island.vue` 收到 `phase-completed` 时触发（主窗口端）

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/components/ToastNotification.vue` | **新建** | 通知悬浮窗组件 |
| `src/components/Island.vue` | 修改 | 监听 phase-completed，集成 ToastNotification |
| `src/composables/useTimer.ts` | 修改 | onPhaseDone 不自动跳转；新增 startBreak/continueFocus/abandonWithCount |
| `src/composables/useTimerBridge.ts` | 修改 | 发射 phase-completed；监听 notification-action |
| `src/composables/useSettings.ts` | 修改 | 新增 notificationSound 字段 |
| `src/panel/SettingsPage.vue` | 修改 | 新增通知提示音开关 |

---

## 边界情况

- 通知显示期间鼠标靠近灵动岛 → hide 状态优先级低于通知，通知仍然可见
- 通知显示期间 idle 检测触发 alert → alert 不覆盖通知
- 用户在休息通知弹窗时按 Escape → 无视，必须点击按钮
- 窗口缩放 (`islandScale`) 影响时 → 通知宽度跟随灵动岛宽度缩放

---

## 测试要点

- [ ] 番茄钟归零 → 通知弹出，计时器暂停
- [ ] 点击「休息」→ 通知关闭，休息计时开始
- [ ] 点击「退出」→ 通知关闭，任务计数+1，回到 idle
- [ ] 休息归零 → 通知弹出，计时器暂停
- [ ] 点击「继续」→ 通知关闭，同任务新番茄钟开始
- [ ] 休息「退出」→ 通知关闭，回到 idle
- [ ] 通知声音开关生效
- [ ] islandScale 缩放通知正常显示
- [ ] `npx vue-tsc --noEmit` 通过
- [ ] `cargo check` 通过
