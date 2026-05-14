# 番茄钟完成通知悬浮窗 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 番茄钟倒计时归零时弹出通知悬浮窗，用户手动选择后续操作（休息/退出/继续），不再自动跳转下一阶段。

**Architecture:** 新增 ToastNotification.vue 组件在灵动岛窗口渲染；useTimer.ts 改为暂停等待用户操作；useTimerBridge.ts 新增双向事件通信（phase-completed → island，notification-action → panel）；useSettings.ts 新增 notificationSound 开关。

**Tech Stack:** Vue 3 + TypeScript + Tauri events + Web Audio API

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `src/components/ToastNotification.vue` | **新建** - 通知悬浮窗 UI 组件，展示图标+文案+操作按钮 |
| `src/components/Island.vue` | 监听 phase-completed 事件，集成 ToastNotification，处理通知音效 |
| `src/composables/useTimer.ts` | 修改 onPhaseDone 不自动跳转；新增 startBreak/continueFocus/resetToIdle |
| `src/composables/useTimerBridge.ts` | 发射 phase-completed 事件；监听 notification-action 事件并调用 timer 方法 |
| `src/composables/useSettings.ts` | 新增 notificationSound 字段（默认 true） |
| `src/panel/SettingsPage.vue` | 新增「通知提示音」开关 UI |

---

### Task 1: 修改 useTimer.ts — 停止自动跳转 + 新增动作方法

**Files:**
- Modify: `src/composables/useTimer.ts`

- [ ] **Step 1: 修改 onPhaseDone() 停止自动跳转**

找到 `onPhaseDone` 函数（约第 46-62 行），将自动跳转逻辑替换为仅停止计时、保留 callbacks 调用：

```typescript
function onPhaseDone() {
  onDoneCallbacks.forEach(cb => cb(phase.value, activeTaskId.value))
  // 停止计时，不自动跳转。由通知按钮决定后续动作。
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  phaseEndAtMs = null
  running.value = false
}
```

- [ ] **Step 2: 新增 startBreak() 方法**

在 `skipToBreak()` 之后添加：

```typescript
function startBreak() {
  phase.value = 'break'
  focusStartedAt.value = null
  const breakSecs = settings.value.breakDuration * 60
  remaining.value = breakSecs
  totalDuration.value = breakSecs
  phaseEndAtMs = Date.now() + breakSecs * 1000
  resume()
}
```

- [ ] **Step 3: 新增 continueFocus() 方法**

在 `startBreak()` 之后添加：

```typescript
function continueFocus() {
  phase.value = 'focus'
  focusStartedAt.value = Date.now()
  const focusSecs = settings.value.focusDuration * 60
  remaining.value = focusSecs
  totalDuration.value = focusSecs
  phaseEndAtMs = Date.now() + focusSecs * 1000
  resume()
}
```

（注意：continueFocus 不重置 activeTaskId，保持同一任务继续）

- [ ] **Step 4: 新增 resetToIdle() 方法**

在 `continueFocus()` 之后添加：

```typescript
function resetToIdle() {
  phase.value = 'focus'
  focusStartedAt.value = null
  phaseEndAtMs = null
  const focusSecs = settings.value.focusDuration * 60
  remaining.value = focusSecs
  totalDuration.value = focusSecs
  activeTaskId.value = null
  activeTaskTitle.value = null
  running.value = false
}
```

- [ ] **Step 5: 将新方法加入 return 对象**

在 return 对象中添加 `startBreak`, `continueFocus`, `resetToIdle`：

```typescript
return {
  phase,
  remaining,
  totalDuration,
  running,
  activeTaskId,
  activeTaskTitle,
  focusStartedAt,
  progress,
  displayTime,
  start,
  resume,
  pause,
  skipToBreak,
  skipBreak,
  abandon,
  startBreak,
  continueFocus,
  resetToIdle,
  onPhaseDoneCallback,
}
```

- [ ] **Step 6: 验证 typecheck**

Run: `npx vue-tsc --noEmit`
Expected: No new errors.

- [ ] **Step 7: Commit**

```bash
git add src/composables/useTimer.ts
git commit -m "feat: 停止番茄钟自动跳转，新增 startBreak/continueFocus/resetToIdle 方法"
```

---

### Task 2: 修改 useTimerBridge.ts — 新增双向事件通信

**Files:**
- Modify: `src/composables/useTimerBridge.ts`

- [ ] **Step 1: 修改 onPhaseDoneCallback 发射 phase-completed 事件**

将现有 `onPhaseDoneCallback` 中的自动记录统计逻辑保留，在最后发射 `phase-completed` 事件：

```typescript
timer.onPhaseDoneCallback((phase, taskId) => {
  // 记录统计（保持现有逻辑）
  if (phase === 'focus' && taskId) {
    incrementPomodoro(taskId)
    const focusMinutes = settings.value.focusDuration
    recordPomodoro(focusMinutes)
    recordAchievementPomodoro()

    const startHour = timer.focusStartedAt.value === null
      ? null
      : new Date(timer.focusStartedAt.value).getHours()
    if (startHour !== null) {
      if (startHour < 6) {
        recordEarlyBird()
      } else if (startHour >= 23) {
        recordNightOwl()
      }
    }
  }

  // 发射通知事件到灵动岛
  emit('phase-completed', {
    phase,
    taskId,
    taskTitle: timer.activeTaskTitle.value ??
      tasks.value.find(t => t.id === taskId)?.title ?? null,
  })

  // 同步最终状态
  emitTimerState(true)
})
```

- [ ] **Step 2: 新增 notification-action 事件监听**

在 `startBridge()` 函数末尾（`listen('timer-state-request', ...)` 之后）添加：

```typescript
// 监听灵动岛发来的通知按钮操作
listen('notification-action', ({ payload }: { payload: { action: string; taskId: string | null } }) => {
  switch (payload.action) {
    case 'start-break':
      timer.startBreak()
      break
    case 'abandon-focus':
      // 番茄完成但用户选择退出：计数已记录（在 onPhaseDoneCallback 中），直接回到 idle
      timer.resetToIdle()
      break
    case 'continue-focus':
      timer.continueFocus()
      break
    case 'abandon-break':
      // 休息完成但用户选择退出：回到 idle
      timer.resetToIdle()
      break
  }
  emitTimerState(true)
}).catch(() => {})
```

- [ ] **Step 3: 验证 typecheck**

Run: `npx vue-tsc --noEmit`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/composables/useTimerBridge.ts
git commit -m "feat: 新增 phase-completed 和 notification-action 双向事件通信"
```

---

### Task 3: 新建 ToastNotification.vue 组件

**Files:**
- Create: `src/components/ToastNotification.vue`

- [ ] **Step 1: 创建组件**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { TimerPhase } from '../composables/useTimer'

const props = defineProps<{
  phase: TimerPhase
  taskTitle: string | null
}>()

const emit = defineEmits<{
  action: [value: 'start-break' | 'abandon-focus' | 'continue-focus' | 'abandon-break']
}>()

const isFocus = computed(() => props.phase === 'focus')

const mainTitle = computed(() => isFocus.value ? '完成了一个番茄' : '休息结束')
const subTitle = computed(() => isFocus.value ? '休息一下吧' : '准备开启下一个番茄钟吗')
const accentColor = computed(() => isFocus.value ? 'var(--focus-color)' : 'var(--break-color)')
const primaryAction = computed(() => isFocus.value ? 'start-break' as const : 'continue-focus' as const)
const secondaryAction = computed(() => isFocus.value ? 'abandon-focus' as const : 'abandon-break' as const)
const primaryLabel = computed(() => isFocus.value ? '休息' : '继续')
const secondaryLabel = '退出'
</script>

<template>
  <div class="toast-notification">
    <!-- 左侧图标 -->
    <div class="toast-icon" :style="{ background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 72%, white))` }">
      <svg v-if="isFocus" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    </div>

    <!-- 中间文案 -->
    <div class="toast-text">
      <div class="toast-title">{{ mainTitle }}</div>
      <div class="toast-sub">{{ subTitle }}</div>
    </div>

    <!-- 右侧按钮 -->
    <div class="toast-actions">
      <button
        class="toast-btn primary"
        :style="{ background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 72%, white))` }"
        @click="emit('action', primaryAction)"
      >
        {{ primaryLabel }}
      </button>
      <button
        class="toast-btn secondary"
        @click="emit('action', secondaryAction)"
      >
        {{ secondaryLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-notification {
  width: calc(316px * var(--island-scale, 1));
  background: rgba(30, 30, 36, 0.96);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  padding: calc(12px * var(--island-scale, 1)) calc(16px * var(--island-scale, 1));
  display: flex;
  align-items: center;
  gap: calc(10px * var(--island-scale, 1));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  animation: toast-enter 300ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

.toast-icon {
  width: calc(36px * var(--island-scale, 1));
  height: calc(36px * var(--island-scale, 1));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.toast-icon svg {
  width: calc(18px * var(--island-scale, 1));
  height: calc(18px * var(--island-scale, 1));
}

.toast-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.toast-title {
  font-size: calc(12.5px * var(--island-scale, 1));
  font-weight: 600;
  color: white;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast-sub {
  font-size: calc(10.5px * var(--island-scale, 1));
  color: rgba(255, 255, 255, 0.48);
  line-height: 1.3;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast-actions {
  display: flex;
  gap: calc(6px * var(--island-scale, 1));
  flex-shrink: 0;
}

.toast-btn {
  height: calc(30px * var(--island-scale, 1));
  padding: 0 calc(16px * var(--island-scale, 1));
  border-radius: calc(15px * var(--island-scale, 1));
  border: none;
  font-size: calc(12px * var(--island-scale, 1));
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.12s ease, opacity 0.12s ease;
}

.toast-btn:active {
  transform: scale(0.95);
}

.toast-btn.primary {
  color: white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.toast-btn.secondary {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.65);
  padding: 0 calc(14px * var(--island-scale, 1));
}

.toast-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
}

@keyframes toast-enter {
  0% {
    opacity: 0;
    transform: scale(0.85) translateY(4px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
```

- [ ] **Step 2: 验证 typecheck**

Run: `npx vue-tsc --noEmit`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ToastNotification.vue
git commit -m "feat: 新增 ToastNotification 通知悬浮窗组件"
```

---

### Task 4: 修改 Island.vue — 集成通知悬浮窗

**Files:**
- Modify: `src/components/Island.vue`

- [ ] **Step 1: 引入 ToastNotification 组件和类型**

在 `<script setup>` 顶部 imports 中添加：

```typescript
import ToastNotification from './ToastNotification.vue'
```

- [ ] **Step 2: 新增通知状态变量**

在 `<script setup>` 中、`let panelMotionTimer` 后面添加：

```typescript
// 通知悬浮窗状态
const showNotification = ref(false)
const notificationPhase = ref<TimerPhase>('focus')
const notificationTaskTitle = ref<string | null>(null)
```

- [ ] **Step 3: 新增通知音效函数**

添加音效播放函数（使用 Web Audio API）：

```typescript
function playNotificationSound() {
  if (!settings.value.notificationSound) return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    // 简短双音提示
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // 静默忽略音频播放失败
  }
}
```

- [ ] **Step 4: 新增 phase-completed 事件监听**

在 `onMounted` 中、`unlistenRadio` 监听之后添加：

```typescript
const unlistenPhaseCompleted = await listen<{ phase: TimerPhase; taskId: string | null; taskTitle: string | null }>(
  'phase-completed',
  ({ payload }) => {
    notificationPhase.value = payload.phase
    notificationTaskTitle.value = payload.taskTitle
    showNotification.value = true
    playNotificationSound()
  },
)
```

- [ ] **Step 5: 新增通知按钮处理函数**

添加处理通知按钮点击的函数：

```typescript
function onNotificationAction(action: 'start-break' | 'abandon-focus' | 'continue-focus' | 'abandon-break') {
  showNotification.value = false
  emit('notification-action', { action, taskId: timer.activeTaskId.value })
  // 主窗口状态跟随操作更新
  if (action === 'start-break') {
    setState('break')
  } else if (action === 'continue-focus') {
    setState('focus')
  } else {
    // abandon-focus 或 abandon-break → 回到 idle
    setState('idle')
  }
}
```

- [ ] **Step 6: 添加 unlisten 清理**

在 `onUnmounted` 中添加清理：

```typescript
unlistenPhaseCompleted?.()
```

同时声明变量：

```typescript
let unlistenPhaseCompleted: (() => void) | null = null
```

- [ ] **Step 7: 在模板中集成 ToastNotification**

在模板的 `island-container` div 内部、`.capsule-motion` 之前插入通知组件。当通知显示时替换岛屿内容：

```html
<template>
  <div class="island-container w-full h-full flex items-start justify-center">
    <!-- 通知悬浮窗：覆盖在岛屿上方 -->
    <div v-if="showNotification" class="notification-overlay">
      <ToastNotification
        :phase="notificationPhase"
        :task-title="notificationTaskTitle"
        @action="onNotificationAction"
      />
      <!-- 通知下方的岛屿条（简化显示） -->
      <div
        class="capsule-shell relative flex items-center justify-center mt-[-4px] z-[1]"
        :style="{
          width: capsuleWidth + 'px',
          height: capsuleHeight + 'px',
          borderRadius: capsuleRadius + 'px',
        }"
      >
        <span class="text-white/40" :style="{ fontSize: `calc(10px * var(--island-scale, 1))` }">专注岛</span>
      </div>
    </div>

    <!-- 正常岛屿（无通知时） -->
    <div v-else class="capsule-motion" ...>
      <!-- 保持现有内容不变 -->
    </div>
  </div>
</template>
```

- [ ] **Step 8: 验证 typecheck**

Run: `npx vue-tsc --noEmit`
Expected: No new errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/Island.vue
git commit -m "feat: Island.vue 集成通知悬浮窗和音效"
```

---

### Task 5: 修改 useSettings.ts — 新增 notificationSound 字段

**Files:**
- Modify: `src/composables/useSettings.ts`

- [ ] **Step 1: 在 Settings 接口中添加 notificationSound**

```typescript
export interface Settings {
  islandOpacity: number
  islandScale: number
  focusDuration: number
  breakDuration: number
  colorMode: ColorMode
  activeThemeId: string
  idleMottos: string[]
  shortcutKey: string
  autoCheckUpdates: boolean
  notificationSound: boolean   // 新增
}
```

- [ ] **Step 2: 在 DEFAULT_SETTINGS 中添加默认值**

```typescript
const DEFAULT_SETTINGS: Settings = {
  // ... 现有字段
  autoCheckUpdates: true,
  notificationSound: true,   // 新增，默认开启
}
```

- [ ] **Step 3: 验证 typecheck**

Run: `npx vue-tsc --noEmit`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/composables/useSettings.ts
git commit -m "feat: Settings 新增 notificationSound 字段"
```

---

### Task 6: 修改 SettingsPage.vue — 新增通知提示音开关

**Files:**
- Modify: `src/panel/SettingsPage.vue`

- [ ] **Step 1: 在「快捷操作」section 之后添加「通知」section**

在 `<!-- 快捷操作 -->` section 的 `</div>` 之后、`<!-- 色彩主题 -->` 之前插入：

```html
    <!-- 通知 -->
    <div class="settings-section">
      <div class="section-title">通知</div>
      <div class="update-toggle-row">
        <div class="update-copy">
          <span class="update-label">通知提示音</span>
          <span class="update-hint">番茄钟或休息结束时播放提示音</span>
        </div>
        <label class="switch" aria-label="通知提示音">
          <input v-model="settings.notificationSound" type="checkbox" />
          <span class="switch-track"></span>
        </label>
      </div>
    </div>
```

- [ ] **Step 2: 验证 typecheck**

Run: `npx vue-tsc --noEmit`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/panel/SettingsPage.vue
git commit -m "feat: SettingsPage 新增通知提示音开关"
```

---

### Task 7: 端到端验证

- [ ] **Step 1: TypeScript 类型检查**

```bash
npx vue-tsc --noEmit
```
预期：无错误。

- [ ] **Step 2: Rust 编译检查**

```bash
cd src-tauri && cargo check
```
预期：无错误。

- [ ] **Step 3: 手动测试清单**

启动 `npm run dev`，验证：
1. 开始番茄钟 → 倒计时归零 → 通知弹出（橙色，显示"完成了一个番茄 休息一下吧"）
2. 点击「休息」→ 通知关闭，休息计时开始，灵动岛显示 green break 状态
3. 再开始一个番茄钟，到时间后点「退出」→ 通知关闭，回到 idle，任务完成数+1
4. 休息倒计时归零 → 通知弹出（绿色，显示"休息结束 准备开启下一个番茄钟吗"）
5. 点击「继续」→ 通知关闭，同任务番茄钟重新开始
6. 休息「退出」→ 回到 idle
7. 设置中关闭通知提示音 → 通知弹出时无声音
8. 设置中开启通知提示音 → 通知弹出时有提示音
9. 调整 islandScale → 通知宽度跟随缩放

- [ ] **Step 4: Commit final verification**

```bash
git add -A
git commit -m "chore: 通知悬浮窗端到端验证通过"
```
