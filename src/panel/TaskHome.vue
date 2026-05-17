<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTasks, getTaskTimeCategory } from '../composables/useTasks'
import { useTimerBridge } from '../composables/useTimerBridge'

const emit = defineEmits<{ viewTodo: [] }>()

const { todayTasks, activeTasks } = useTasks()
const { start, pause, resume, running, activeTaskId, displayTime, phase, abandon } = useTimerBridge()

const newTitle = ref('')

const topTasks = computed(() => {
  const active = activeTasks.value
  const running = active.find(t => t.id === activeTaskId.value)
  const rest = active
    .filter(t => t.id !== activeTaskId.value)
    .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)
    .slice(0, 4)
  if (running) return [running, ...rest].slice(0, 5)
  return rest.slice(0, 5)
})

function handleStartTask(taskId: string, title: string) {
  if (activeTaskId.value === taskId) {
    if (running.value) pause()
    else resume()
  } else {
    start(taskId, title)
  }
}

function handleDoneTask(taskId: string) {
  if (activeTaskId.value === taskId) {
    abandon()
  }
}

function handleAddTask() {
  const t = newTitle.value.trim()
  if (!t) return
  const { addTask } = useTasks()
  addTask(t)
  newTitle.value = ''
}

function formatShortTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function handleInput(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleAddTask()
  }
}
</script>

<template>
  <div class="task-home">
    <!-- Quick add -->
    <div class="zone-1">
      <input
        class="quick-add-input"
        v-model="newTitle"
        placeholder="接下来专注做什么..."
        @keydown="handleInput"
        autofocus
      />
    </div>

    <!-- Focus tasks -->
    <div class="zone-2">
      <div class="zone-header" @click="emit('viewTodo')" style="cursor: pointer;">
        <span>核心专注区</span>
        <span class="zone-more">查看全部 →</span>
      </div>
      <div v-if="topTasks.length === 0" class="empty-hint">
        暂无主打任务，输入后按回车添加
      </div>
      <div
        v-for="task in topTasks"
        :key="task.id"
        class="focus-task-item"
        :class="{ 'is-running': activeTaskId === task.id }"
        :style="activeTaskId === task.id ? { '--active-color': phase === 'break' ? 'var(--break-color)' : 'var(--focus-color)' } : undefined"
      >
        <!-- Running state -->
        <template v-if="activeTaskId === task.id">
          <template v-if="running">
            <div class="running-card">
              <div class="running-header">
                <span class="running-dot">●</span>
                <span class="task-title">{{ task.title }}</span>
                <span class="task-timer">{{ displayTime }}</span>
              </div>
              <div class="running-actions">
                <button class="run-btn pause-btn" @click="pause()" title="暂停">❚❚ 暂停</button>
                <button class="run-btn done-btn" @click="handleDoneTask(task.id)" title="完成">✓ 完成</button>
                <button class="run-btn abandon-btn" @click="abandon()" title="停止">■ 停止</button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="running-card paused">
              <div class="running-header">
                <span class="running-dot paused-dot">●</span>
                <span class="task-title">{{ task.title }}</span>
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

        <!-- Normal state -->
        <template v-else>
          <button
            class="task-checkbox"
            :class="{ checked: task.completed }"
            @click="handleDoneTask(task.id)"
          >✓</button>
          <span class="task-title" @click="handleStartTask(task.id, task.title)">{{ task.title }}</span>
          <span v-if="task.pomodoroCount > 0" class="pomo-count">🍅{{ task.pomodoroCount }}</span>
          <span v-if="task.dueDate" class="task-date" :class="{ overdue: getTaskTimeCategory(task) === 'overdue' }">
            {{ formatShortTime(new Date(task.dueDate + 'T00:00:00').getTime()) }}
          </span>
          <button class="start-btn" @click="handleStartTask(task.id, task.title)" title="开始专注">▶</button>
        </template>
      </div>
    </div>

    <!-- Today count summary -->
    <div class="zone-3" @click="emit('viewTodo')" style="cursor: pointer;">
      <div class="today-summary">
        <span class="today-label">今天</span>
        <span class="today-count">{{ todayTasks.length }} 项</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../styles.css";

.task-home {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: 12px;
  gap: 12px;
  color: #e8e8ea;
}

.zone-1 { flex-shrink: 0; }

.quick-add-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #fff;
  outline: none;
  transition: all 0.2s;
  font-family: inherit;
}

.quick-add-input:focus {
  border-color: color-mix(in srgb, var(--focus-color) 50%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus-color) 12%, transparent);
}

.quick-add-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.zone-2 { flex-shrink: 0; }

.zone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.5px;
}

.zone-more {
  font-size: 10px;
  color: var(--focus-color);
  opacity: 0.7;
}

.zone-more:hover { opacity: 1; }

.empty-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.25);
  padding: 16px 0;
  text-align: center;
}

.focus-task-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  margin-bottom: 4px;
  transition: background 0.15s;
  cursor: default;
}

.focus-task-item:hover { background: rgba(255, 255, 255, 0.04); }

.focus-task-item.is-running {
  background: color-mix(in srgb, var(--focus-color) 6%, rgba(28, 28, 32, 0.95));
  border: 1px solid color-mix(in srgb, var(--focus-color) 20%, transparent);
  border-radius: 10px;
}

.running-card { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.running-card.paused { opacity: 0.8; }

.running-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.running-dot { color: var(--focus-color); font-size: 10px; }
.running-dot.paused-dot { color: rgba(255, 255, 255, 0.4); }

.task-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.task-timer {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
}

.running-actions { display: flex; gap: 6px; }

.run-btn {
  height: 24px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
}

.run-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.done-btn { color: #4ade80; border-color: rgba(74, 222, 128, 0.2); }
.done-btn:hover { background: rgba(74, 222, 128, 0.1); }
.abandon-btn { color: rgba(255, 255, 255, 0.4); }
.abandon-btn:hover { color: #f87171; background: rgba(248, 113, 113, 0.1); }

.task-checkbox {
  width: 18px; height: 18px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  background: transparent;
  color: transparent;
  font-size: 10px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
  padding: 0;
}

.task-checkbox:hover { border-color: var(--focus-color); color: var(--focus-color); background: color-mix(in srgb, var(--focus-color) 10%, transparent); }
.task-checkbox.checked { border-color: var(--break-color); color: var(--break-color); background: color-mix(in srgb, var(--break-color) 15%, transparent); }

.pomo-count { font-size: 10px; color: var(--focus-color); opacity: 0.6; }

.task-date {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.04);
  padding: 1px 6px;
  border-radius: 4px;
}

.task-date.overdue {
  color: var(--focus-color);
  background: color-mix(in srgb, var(--focus-color) 12%, transparent);
}

.start-btn {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--focus-color) 25%, transparent);
  color: var(--focus-color);
  font-size: 10px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
  padding: 0;
}

.start-btn:hover { background: color-mix(in srgb, var(--focus-color) 25%, transparent); transform: scale(1.08); }

.zone-3 { flex-shrink: 0; margin-top: 4px; }

.today-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.2s;
}

.today-summary:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.today-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
}

.today-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  flex: 1;
}

.today-summary svg {
  color: rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
}
</style>
