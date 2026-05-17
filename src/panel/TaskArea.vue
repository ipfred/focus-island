<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTasks, type Task } from '../composables/useTasks'
import { useTimerBridge } from '../composables/useTimerBridge'
import { useRadio } from '../composables/useRadio'

// Module-level singleton — persists across component remounts
const recentTaskIds = ref<string[]>([])

const emit = defineEmits<{ close: []; navigateToTodo: [tab?: string] }>()

const {
  tasks,
  addTask,
  setTaskPriority,
  incrementPomodoro,
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

// Track active task changes — any start pushes to the top of the list
watch(activeTaskId, (newId, _oldId) => {
  if (newId) {
    recentTaskIds.value = [newId, ...recentTaskIds.value.filter(id => id !== newId)].slice(0, 3)
  }
})

// Seed on mount if timer is already running
if (activeTaskId.value && !recentTaskIds.value.includes(activeTaskId.value)) {
  recentTaskIds.value = [activeTaskId.value, ...recentTaskIds.value].slice(0, 3)
}

const recentTasks = computed<Task[]>(() => {
  return recentTaskIds.value
    .map(id => tasks.value.find(t => t.id === id))
    .filter((t): t is Task => !!t)
})

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
function handleToggleTimer(taskId: string) {
  if (activeTaskId.value === taskId) {
    if (running.value) pause()
    else resume()
  } else {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      start(taskId, task.title)
    }
  }
}

function handleDone(taskId: string) {
  if (activeTaskId.value === taskId) {
    incrementPomodoro(taskId)
    abandon()
  }
}

function handleStop(taskId: string) {
  if (activeTaskId.value === taskId) {
    abandon()
  }
}

function handlePlay(task: Task) {
  start(task.id, task.title)
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

    <!-- Zone 2: Focus -->
    <div class="focus-zone">
      <div class="focus-header">
        <span class="zone-label">核心专注区</span>
      </div>

      <div v-if="recentTasks.length > 0" class="focus-list">
        <div
          v-for="task in recentTasks"
          :key="task.id"
          class="focus-card"
          :class="{ 'is-active': activeTaskId === task.id }"
          :style="activeTaskId === task.id ? { '--active-color': phase === 'break' ? 'var(--break-color)' : 'var(--focus-color)' } : undefined"
        >
          <!-- Active task: running -->
          <template v-if="activeTaskId === task.id && running">
            <div class="focus-top-row">
              <span class="running-dot">●</span>
              <span class="focus-title">{{ task.title }}</span>
              <span class="focus-timer">{{ displayTime }}</span>
            </div>
            <div class="focus-phase">{{ phase === 'focus' ? '专注中' : '休息中' }}</div>
            <div class="focus-actions">
              <button class="act-btn pause-btn" @click="handleToggleTimer(task.id)" title="暂停">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                暂停
              </button>
              <button class="act-btn done-btn" @click="handleDone(task.id)" title="完成">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                完成
              </button>
              <button class="act-btn stop-btn" @click="handleStop(task.id)" title="停止">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
                停止
              </button>
            </div>
          </template>

          <!-- Active task: paused -->
          <template v-else-if="activeTaskId === task.id && !running">
            <div class="focus-top-row">
              <span class="paused-dot">●</span>
              <span class="focus-title">{{ task.title }}</span>
              <span class="focus-timer">{{ displayTime }}</span>
            </div>
            <div class="focus-phase">已暂停</div>
            <div class="focus-actions">
              <button class="act-btn resume-btn" @click="handleToggleTimer(task.id)" title="继续">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>
                继续
              </button>
              <button class="act-btn done-btn" @click="handleDone(task.id)" title="完成">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                完成
              </button>
              <button class="act-btn stop-btn" @click="handleStop(task.id)" title="停止">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
                停止
              </button>
            </div>
          </template>

          <!-- Inactive task: show play button -->
          <template v-else>
            <div class="focus-top-row">
              <button class="focus-play-btn" @click="handlePlay(task)" title="开始专注">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>
              </button>
              <span class="focus-title inactive">{{ task.title }}</span>
              <span v-if="task.pomodoroCount > 0" class="focus-pomo">🍅 {{ task.pomodoroCount }}</span>
              <button class="focus-remove-btn" @click="recentTaskIds = recentTaskIds.filter(id => id !== task.id)" title="移除">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </template>
        </div>
      </div>

      <div v-else class="focus-empty">
        <span class="focus-empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </span>
        <span class="focus-empty-text">在 TODO 中选择任务开始专注</span>
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

/* Shared zone label */
.zone-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
  letter-spacing: 0.5px;
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

.focus-header {
  margin-bottom: 6px;
}

.focus-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.focus-card {
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 8px 10px;
  transition: all 0.2s;
}

.focus-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}

.focus-card.is-active {
  background: color-mix(in srgb, var(--active-color) 8%, rgba(28, 28, 32, 0.95));
  border-color: color-mix(in srgb, var(--active-color) 25%, transparent);
  border-left: 3px solid var(--active-color);
}

.focus-top-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.running-dot {
  color: var(--active-color);
  font-size: 10px;
  flex-shrink: 0;
  animation: blink 1.2s ease-in-out infinite;
}

.paused-dot {
  color: var(--active-color);
  font-size: 10px;
  flex-shrink: 0;
  animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.focus-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.focus-title.inactive {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.75);
}

.focus-timer {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
  flex-shrink: 0;
}

.focus-phase {
  font-size: 10px;
  color: var(--active-color);
  margin-top: 2px;
  padding-left: 18px;
}

.focus-pomo {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
  flex-shrink: 0;
}

.focus-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.act-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.pause-btn,
.resume-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
}

.pause-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.resume-btn {
  flex: 1;
  background: color-mix(in srgb, var(--focus-color) 20%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 40%, transparent);
  color: var(--focus-color);
}

.resume-btn:hover {
  background: color-mix(in srgb, var(--focus-color) 30%, transparent);
}

.done-btn {
  background: color-mix(in srgb, var(--break-color) 15%, transparent);
  border-color: color-mix(in srgb, var(--break-color) 25%, transparent);
  color: var(--break-color);
}

.done-btn:hover {
  background: color-mix(in srgb, var(--break-color) 25%, transparent);
}

.stop-btn {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.4);
}

.stop-btn:hover {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.25);
  color: #f87171;
}

/* Inactive task play button */
.focus-play-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--focus-color) 30%, transparent);
  color: var(--focus-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  transition: all 0.15s;
}

.focus-play-btn:hover {
  background: color-mix(in srgb, var(--focus-color) 25%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 50%, transparent);
  transform: scale(1.08);
}

/* Remove from focus zone button */
.focus-remove-btn {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  transition: all 0.15s;
  opacity: 0;
}

.focus-card:hover .focus-remove-btn {
  opacity: 1;
}

.focus-remove-btn:hover {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
}

/* Empty state */
.focus-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 18px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.08);
}

.focus-empty-icon {
  color: rgba(255, 255, 255, 0.2);
}

.focus-empty-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
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
