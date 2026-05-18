<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useTasks, type Task } from '../composables/useTasks'
import { useTimerBridge } from '../composables/useTimerBridge'
import { useRadio } from '../composables/useRadio'

const emit = defineEmits<{ close: []; navigateToTodo: [tab?: string] }>()

const {
  tasks,
  addTask,
  deleteTask,
  setTaskPriority,
  incrementPomodoro,
  touchTask,
  todayTasks,
  tomorrowTasks,
  weekTasks,
  completedTasks,
} = useTasks()
const {
  start,
  pause,
  resume,
  running,
  activeTaskId,
  displayTime,
  phase,
  abandon,
} = useTimerBridge()
const { playing, loading, currentStation, toggle: toggleRadio } = useRadio()

// --- Quick-add state ---
const newTitle = ref('')
const quickAddRef = ref<HTMLInputElement | null>(null)

// Touch lastActiveAt when a task starts
watch(activeTaskId, (newId) => {
  if (newId) touchTask(newId)
})

// Recent 3 tasks by lastActiveAt
const recentTasks = computed<Task[]>(() => {
  return tasks.value
    .filter(t => !t.completed && t.lastActiveAt > 0)
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    .slice(0, 3)
})

// --- Title scroll animation ---
type ScrollPhase = 'start' | 'scroll' | 'end'
interface ScrollState {
  taskId: string
  container: HTMLElement
  text: HTMLElement
  frameId: number | null
  offset: number
  waitFrames: number
  phase: ScrollPhase
}

const SCROLL_SPEED = 0.5
const START_WAIT_FRAMES = 30
const END_WAIT_FRAMES = 60
let activeScroll: ScrollState | null = null

function startScroll(taskId: string, eventTarget: EventTarget | null) {
  const containerEl = eventTarget as HTMLElement | null
  if (!containerEl) return
  const textEl = containerEl.querySelector('.task-title-text') as HTMLElement | null
  if (!textEl) return
  const overflow = textEl.scrollWidth - containerEl.clientWidth
  if (overflow <= 0) return
  stopScroll()
  textEl.style.transform = 'translateX(0)'
  activeScroll = { taskId, container: containerEl, text: textEl, frameId: null, offset: 0, waitFrames: START_WAIT_FRAMES, phase: 'start' }
  scheduleNextScrollFrame()
}

function scheduleNextScrollFrame() {
  if (!activeScroll) return
  activeScroll.frameId = requestAnimationFrame(runScrollFrame)
}

function runScrollFrame() {
  const state = activeScroll
  if (!state) return
  if (!state.container.isConnected || !state.text.isConnected) { stopScroll(state.taskId); return }
  const overflow = state.text.scrollWidth - state.container.clientWidth
  if (overflow <= 0) { stopScroll(state.taskId); return }
  if (state.phase !== 'scroll') {
    state.waitFrames -= 1
    if (state.waitFrames <= 0) {
      if (state.phase === 'end') { state.offset = 0; state.text.style.transform = 'translateX(0)' }
      state.phase = 'scroll'
    }
    scheduleNextScrollFrame(); return
  }
  state.offset += SCROLL_SPEED
  if (state.offset >= overflow) {
    state.offset = overflow
    state.text.style.transform = `translateX(-${overflow}px)`
    state.phase = 'end'
    state.waitFrames = END_WAIT_FRAMES
  } else {
    state.text.style.transform = `translateX(-${state.offset}px)`
  }
  scheduleNextScrollFrame()
}

function stopScroll(taskId?: string) {
  if (!activeScroll) return
  if (taskId && activeScroll.taskId !== taskId) return
  if (activeScroll.frameId !== null) cancelAnimationFrame(activeScroll.frameId)
  activeScroll.text.style.transform = 'translateX(0)'
  activeScroll = null
}

onBeforeUnmount(() => { stopScroll() })

function formatTime(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

// --- Quick-add ---
async function handleInput(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    const t = newTitle.value.trim()
    if (!t) return
    const task = addTask(t)
    newTitle.value = ''
    if (event.shiftKey) {
      setTaskPriority(task.id, 1)
      start(task.id, task.title)
      emit('close')
    }
  }
}

// --- Timer Controls ---
function handleStartTask(task: Task) {
  if (activeTaskId.value === task.id) {
    if (running.value) pause()
    else resume()
  } else {
    touchTask(task.id)
    start(task.id, task.title)
  }
}

function handleDoneTask(taskId: string) {
  if (activeTaskId.value === taskId) {
    incrementPomodoro(taskId)
    abandon()
  }
}
</script>

<template>
  <div class="home-page">
    <!-- Zone 1: Quick-add -->
    <div class="quick-add-zone">
      <input
        ref="quickAddRef"
        v-model="newTitle"
        class="quick-add-input"
        placeholder="接下来专注做什么... (Shift+Enter 闪电开始)"
        @keydown="handleInput"
      />
    </div>

    <!-- Zone 2: Focus Queue (Recent 3) -->
    <div class="focus-zone">
      <div class="zone-header">核心专注区</div>

      <div class="focus-container">
        <div v-if="recentTasks.length === 0" class="focus-empty">
          <span class="focus-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </span>
          <span class="focus-empty-text">在 TODO 中选择任务开始专注</span>
        </div>

        <div
          v-for="(task, index) in recentTasks"
          :key="task.id"
          class="focus-task-item"
          :class="{ 'is-running': activeTaskId === task.id }"
          :style="activeTaskId === task.id ? { '--active-color': phase === 'break' ? 'var(--break-color)' : 'var(--focus-color)' } : undefined"
        >
        <!-- 运行态 -->
        <template v-if="activeTaskId === task.id">
          <template v-if="running">
            <div class="running-card">
              <div class="running-header">
                <span class="running-dot">●</span>
                <span class="task-title running-title" @mouseenter="startScroll(task.id, $event.currentTarget)" @mouseleave="stopScroll(task.id)">
                  <span class="task-title-text">{{ task.title }}</span>
                </span>
                <span class="task-timer">{{ displayTime }}</span>
              </div>
              <div class="running-actions">
                <button class="run-btn pause-btn" @click="pause()" title="暂停">❚❚ 暂停</button>
                <button class="run-btn done-btn" @click="handleDoneTask(task.id)" title="完成">✓ 完成</button>
                <button class="run-btn abandon-btn" @click="abandon()" title="停止">■ 停止</button>
              </div>
            </div>
          </template>
          <!-- 暂停态 -->
          <template v-else>
            <div class="running-card paused">
              <div class="running-header">
                <span class="running-dot paused-dot">●</span>
                <span class="task-title running-title" @mouseenter="startScroll(task.id, $event.currentTarget)" @mouseleave="stopScroll(task.id)">
                  <span class="task-title-text">{{ task.title }}</span>
                </span>
                <span class="task-timer">{{ displayTime }}</span>
              </div>
              <div class="running-actions">
                <button class="run-btn pause-btn" @click="resume()" title="继续">▶ 继续</button>
                <button class="run-btn done-btn" @click="handleDoneTask(task.id)" title="完成">✓ 完成</button>
                <button class="run-btn abandon-btn" @click="abandon()" title="停止">■ 停止</button>
              </div>
            </div>
          </template>
        </template>

        <!-- 正常态（非活跃任务） -->
        <template v-else>
          <div class="task-row">
            <span class="rank-badge">{{ index === 0 ? '①' : index === 1 ? '②' : '③' }}</span>
            <button class="check-circle" @click="handleDoneTask(task.id)" title="完成"></button>
            <span class="task-title" @mouseenter="startScroll(task.id, $event.currentTarget)" @mouseleave="stopScroll(task.id)">
              <span class="task-title-text">{{ task.title }}</span>
            </span>
            <span class="pomo-count" v-if="task.pomodoroCount > 0">● {{ task.pomodoroCount }}</span>
            <span class="task-time">{{ formatTime(task.createdAt) }}</span>
            <div class="task-actions">
              <button class="act-btn delete" @click="deleteTask(task.id)" title="删除">✕</button>
            </div>
            <button class="start-btn" @click="handleStartTask(task)" title="开始">▶</button>
          </div>
        </template>
      </div>
      </div>
    </div>

    <!-- Zone 3: Radio -->
    <div class="radio-zone">
      <div class="radio-row" @click="toggleRadio">
        <div class="radio-icon-btn" :class="{ playing: playing }">
          <svg v-if="loading" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="12" r="2" opacity="0.3"/><circle cx="12" cy="12" r="2" opacity="0.6"/><circle cx="17" cy="12" r="2"/></svg>
          <svg v-else-if="playing" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7z"/></svg>
        </div>
        <div class="radio-info">
          <span class="radio-name">{{ currentStation?.name ?? '专注电台' }}</span>
          <span class="radio-status">{{ playing ? (loading ? '缓冲中...' : '播放中') : '未播放' }}</span>
        </div>
        <span class="radio-arrow">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </span>
      </div>
    </div>

    <!-- Zone 4: Task cards -->
    <div class="cards-zone">
      <div class="card-grid">
        <button class="task-card" @click="emit('navigateToTodo', 'today')">
          <span class="card-icon today-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </span>
          <span class="card-count">{{ todayTasks.length }}</span>
          <span class="card-label">今天</span>
        </button>
        <button class="task-card" @click="emit('navigateToTodo', 'tomorrow')">
          <span class="card-icon tomorrow-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </span>
          <span class="card-count">{{ tomorrowTasks.length }}</span>
          <span class="card-label">明天</span>
        </button>
        <button class="task-card" @click="emit('navigateToTodo', 'week')">
          <span class="card-icon week-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </span>
          <span class="card-count">{{ weekTasks.length }}</span>
          <span class="card-label">本周</span>
        </button>
        <button class="task-card" @click="emit('navigateToTodo', 'completed')">
          <span class="card-icon done-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </span>
          <span class="card-count">{{ completedTasks.length }}</span>
          <span class="card-label">已完成</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../styles.css";

.home-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  height: 100%;
  overflow-y: auto;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.home-page::-webkit-scrollbar {
  width: 4px;
}
.home-page::-webkit-scrollbar-track {
  background: transparent;
}
.home-page::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}

/* ===== Quick-add Zone ===== */
.quick-add-zone {
  flex-shrink: 0;
}

.quick-add-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px 14px;
  color: #fff;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.quick-add-input:focus {
  border-color: color-mix(in srgb, var(--focus-color) 60%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus-color) 20%, transparent);
}

.quick-add-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

/* ===== Focus Zone ===== */
.focus-zone {
  flex-shrink: 0;
}

.zone-header {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  margin-bottom: 6px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.focus-container {
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 8px;
}

.focus-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
}

.focus-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.25);
}

.focus-empty-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
}

.focus-task-item {
  background: rgba(255, 255, 255, 0.035);
  border-radius: 8px;
  margin-bottom: 4px;
  padding: 5px 10px;
  transition: all 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.focus-task-item:last-child {
  margin-bottom: 0;
}

.focus-task-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}

/* Running task card */
.focus-task-item.is-running {
  background: color-mix(in srgb, var(--active-color) 10%, transparent);
  border-color: color-mix(in srgb, var(--active-color) 30%, transparent);
  border-left: 3px solid var(--active-color);
  padding: 8px 10px;
}

.running-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.running-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.running-dot {
  color: var(--active-color);
  font-size: 10px;
  flex-shrink: 0;
}

.paused-dot {
  animation: blink 1.2s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.running-title {
  color: #fff !important;
  font-weight: 600 !important;
}

.running-actions {
  display: flex;
  gap: 6px;
}

.run-btn {
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s;
  font-family: inherit;
}

.pause-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.pause-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.done-btn {
  background: color-mix(in srgb, var(--break-color) 20%, transparent);
  color: var(--break-color);
  border-color: color-mix(in srgb, var(--break-color) 30%, transparent);
}

.done-btn:hover {
  background: color-mix(in srgb, var(--break-color) 35%, transparent);
}

.abandon-btn {
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  border-color: rgba(255, 255, 255, 0.08);
}

.abandon-btn:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.1);
}

/* Normal task row */
.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.rank-badge {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  flex-shrink: 0;
  color: var(--focus-color);
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  border-radius: 50%;
}

.check-circle {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.28);
  background: transparent;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: border-color 0.2s, background 0.2s;
}

.check-circle:hover {
  border-color: var(--break-color);
  background: color-mix(in srgb, var(--break-color) 20%, transparent);
}

.task-title {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
  min-width: 0;
  cursor: default;
}

.task-title-text {
  display: inline-block;
  will-change: transform;
}

.pomo-count {
  font-size: 11px;
  color: var(--focus-color);
  opacity: 0.7;
}

.task-timer {
  font-size: 13px;
  font-weight: 700;
  color: var(--active-color);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.task-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.focus-task-item:hover .task-actions {
  opacity: 1;
}

/* Unified action button */
.act-btn {
  min-width: 20px;
  height: 20px;
  padding: 1px 4px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  text-align: center;
  font-family: inherit;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.act-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.start-btn {
  min-width: 20px;
  height: 20px;
  padding: 1px 4px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 600;
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--focus-color) 30%, transparent);
  color: var(--focus-color);
  cursor: pointer;
  text-align: center;
  flex-shrink: 0;
  font-family: inherit;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.start-btn:hover {
  background: color-mix(in srgb, var(--focus-color) 25%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 50%, transparent);
}

.act-btn.delete {
  color: rgba(255, 255, 255, 0.5);
}

.act-btn.delete:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.1);
}

.task-time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* ===== Radio Zone ===== */
.radio-zone {
  flex-shrink: 0;
}

.radio-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.2s;
}

.radio-row:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.radio-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
  transition: all 0.2s;
}

.radio-icon-btn.playing {
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  color: var(--focus-color);
}

.radio-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.radio-name {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radio-status {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}

.radio-arrow {
  color: rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
}

/* ===== Cards Zone ===== */
.cards-zone {
  flex: 1;
  min-height: 0;
}

.card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.task-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 16px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.task-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-1px);
}

.task-card:active {
  transform: translateY(0);
}

.card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  margin-bottom: 2px;
}

.today-icon {
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  color: var(--focus-color);
}

.tomorrow-icon {
  background: color-mix(in srgb, #f59e0b 15%, transparent);
  color: #f59e0b;
}

.week-icon {
  background: color-mix(in srgb, #8b5cf6 15%, transparent);
  color: #8b5cf6;
}

.done-icon {
  background: color-mix(in srgb, #10b981 15%, transparent);
  color: #10b981;
}

.card-count {
  font-size: 20px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1;
}

.card-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  font-weight: 500;
}
</style>
