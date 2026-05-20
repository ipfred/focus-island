<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useTasks, type Task } from '../composables/useTasks'
import { useTimerBridge } from '../composables/useTimerBridge'
import { useRadio } from '../composables/useRadio'
import { useTaskGroups } from '../composables/useTaskGroups'
import { getCategoryColor } from '../composables/useMemos'

const emit = defineEmits<{ close: []; navigateToTodo: [tab?: string] }>()

const { groups } = useTaskGroups()

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
  toggleComplete,
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
  toggleComplete(taskId)
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
                <span v-if="task.groupId" class="task-group-badge">
                  <span class="group-dot-sm" :style="{ backgroundColor: getCategoryColor(groups.find(g => g.id === task.groupId)?.color ?? 'yellow').icon }"></span>
                  {{ groups.find(g => g.id === task.groupId)?.name ?? '' }}
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
                <span v-if="task.groupId" class="task-group-badge">
                  <span class="group-dot-sm" :style="{ backgroundColor: getCategoryColor(groups.find(g => g.id === task.groupId)?.color ?? 'yellow').icon }"></span>
                  {{ groups.find(g => g.id === task.groupId)?.name ?? '' }}
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
            <span v-if="task.groupId" class="task-group-badge">
              <span class="group-dot-sm" :style="{ backgroundColor: getCategoryColor(groups.find(g => g.id === task.groupId)?.color ?? 'yellow').icon }"></span>
              {{ groups.find(g => g.id === task.groupId)?.name ?? '' }}
            </span>
            <span class="pomo-count" v-if="task.pomodoroCount > 0">● {{ task.pomodoroCount }}</span>
            <span class="task-time">{{ formatTime(task.createdAt) }}</span>
            <button class="start-btn" @click="handleStartTask(task)" title="开始">▶</button>
          </div>
        </template>
      </div>
      </div>
    </div>

    <!-- Zone 3: Radio -->
    <div class="radio-zone">
      <div class="radio-row">
        <button class="radio-play-btn" :class="{ playing: playing }" @click="toggleRadio">
          <svg v-if="loading" class="loading-spinner" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="6" r="2" opacity="0.3"/>
            <circle cx="12" cy="18" r="2" opacity="0.3"/>
            <circle cx="6" cy="12" r="2" opacity="0.6"/>
            <circle cx="18" cy="12" r="2" opacity="0.6"/>
          </svg>
          <svg v-else-if="playing" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
        <div class="radio-info">
          <span class="radio-name">{{ currentStation?.name ?? '专注电台' }}</span>
          <span class="radio-status">{{ playing ? (loading ? '缓冲中...' : '播放中') : '点击播放' }}</span>
        </div>
        <div class="radio-wave" v-if="playing && !loading">
          <span class="wave-bar"></span>
          <span class="wave-bar"></span>
          <span class="wave-bar"></span>
        </div>
      </div>
    </div>

    <!-- Zone 4: Task cards -->
    <div class="cards-zone">
      <div class="zone-header">任务清单</div>
      <div class="card-grid">
        <button class="task-card" @click="emit('navigateToTodo', 'today')">
          <span class="card-icon today-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </span>
          <div class="card-content">
            <span class="card-label">今天</span>
            <span class="card-count">{{ todayTasks.length }}</span>
          </div>
        </button>
        <button class="task-card" @click="emit('navigateToTodo', 'tomorrow')">
          <span class="card-icon tomorrow-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </span>
          <div class="card-content">
            <span class="card-label">明天</span>
            <span class="card-count">{{ tomorrowTasks.length }}</span>
          </div>
        </button>
        <button class="task-card" @click="emit('navigateToTodo', 'week')">
          <span class="card-icon week-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </span>
          <div class="card-content">
            <span class="card-label">本周</span>
            <span class="card-count">{{ weekTasks.length }}</span>
          </div>
        </button>
        <button class="task-card" @click="emit('navigateToTodo', 'completed')">
          <span class="card-icon done-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
          <div class="card-content">
            <span class="card-label">已完成</span>
            <span class="card-count">{{ completedTasks.length }}</span>
          </div>
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
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.running-title .task-title-text {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
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
  font-weight: 500;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s;
  font-family: inherit;
}

.pause-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.78);
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
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.2s;
}

.radio-play-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
}

.radio-play-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
  transform: scale(1.05);
}

.radio-play-btn:active {
  transform: scale(0.95);
}

.radio-play-btn.playing {
  background: linear-gradient(135deg, color-mix(in srgb, var(--focus-color) 25%, transparent), color-mix(in srgb, var(--focus-color) 15%, transparent));
  border-color: color-mix(in srgb, var(--focus-color) 40%, transparent);
  color: var(--focus-color);
  box-shadow: 0 0 12px color-mix(in srgb, var(--focus-color) 20%, transparent);
}

.radio-play-btn.playing:hover {
  background: linear-gradient(135deg, color-mix(in srgb, var(--focus-color) 35%, transparent), color-mix(in srgb, var(--focus-color) 25%, transparent));
  border-color: color-mix(in srgb, var(--focus-color) 50%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--focus-color) 30%, transparent);
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.radio-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.radio-name {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radio-status {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
}

.radio-wave {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 20px;
  flex-shrink: 0;
}

.wave-bar {
  width: 3px;
  height: 100%;
  background: var(--focus-color);
  border-radius: 2px;
  animation: wave 1.2s ease-in-out infinite;
}

.wave-bar:nth-child(1) {
  animation-delay: 0s;
}

.wave-bar:nth-child(2) {
  animation-delay: 0.2s;
}

.wave-bar:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes wave {
  0%, 100% {
    transform: scaleY(0.3);
    opacity: 0.5;
  }
  50% {
    transform: scaleY(1);
    opacity: 1;
  }
}

/* ===== Cards Zone ===== */
.cards-zone {
  flex: 1;
  min-height: 0;
}

.card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.task-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
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
  border-radius: 8px;
  flex-shrink: 0;
}

.today-icon {
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  color: var(--focus-color);
}

.tomorrow-icon {
  background: color-mix(in srgb, #a78bfa 15%, transparent);
  color: #a78bfa;
}

.week-icon {
  background: color-mix(in srgb, #60a5fa 15%, transparent);
  color: #60a5fa;
}

.done-icon {
  background: color-mix(in srgb, #10b981 15%, transparent);
  color: #10b981;
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.card-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
  line-height: 1;
}

.card-count {
  font-size: 20px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1;
}

.task-group-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.04);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  margin-left: 6px;
}

.group-dot-sm {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
