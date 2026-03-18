<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTasks } from '../composables/useTasks'
import { useTimerBridge } from '../composables/useTimerBridge'
import type { Task, TaskCategory } from '../composables/useTasks'

const props = defineProps<{
  category: TaskCategory
  selectedTaskId: string | null
}>()

const emit = defineEmits<{ taskSelect: [task: Task] }>()

const { tasks, addTask, deleteTask } = useTasks()
const { start, pause, resume, running, activeTaskId, phase, displayTime } = useTimerBridge()

const newTitle = ref('')

const filteredTasks = computed(() =>
  tasks.value.filter(t => !t.completed && t.category === props.category)
)

const completedTasks = computed(() =>
  tasks.value.filter(t => t.completed && t.category === props.category)
)

// 统计：今日完成的番茄数和专注分钟数
const todayPomodoros = computed(() =>
  tasks.value.reduce((sum, t) => sum + t.pomodoroCount, 0)
)
const todayMinutes = computed(() => todayPomodoros.value * 25)

function handleAdd() {
  const t = newTitle.value.trim()
  if (!t) return
  addTask(t, props.category)
  newTitle.value = ''
}

function handleStartTask(task: Task) {
  if (activeTaskId.value === task.id && running.value) {
    pause()
  } else if (activeTaskId.value === task.id && !running.value) {
    resume()
  } else {
    start(task.id)
  }
}

function isActive(task: Task) {
  return activeTaskId.value === task.id
}

function phaseLabel(task: Task) {
  if (!isActive(task)) return ''
  if (phase.value === 'focus') return `专注 ${displayTime.value}`
  return `休息 ${displayTime.value}`
}
</script>

<template>
  <div class="task-area">
    <!-- 统计栏 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-value">{{ todayPomodoros }}</span>
        <span class="stat-label">番茄</span>
      </div>
      <div class="stat-divider" />
      <div class="stat-item">
        <span class="stat-value">{{ todayMinutes }}</span>
        <span class="stat-label">分钟</span>
      </div>
    </div>

    <!-- 新增任务 -->
    <div class="add-task">
      <input
        v-model="newTitle"
        placeholder="新增任务，按 Enter 添加"
        class="add-input"
        maxlength="80"
        @keydown.enter="handleAdd"
      />
      <button class="add-btn" @click="handleAdd">+</button>
    </div>

    <!-- 任务列表 -->
    <div class="task-list">
      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="task-row"
        :class="{ selected: selectedTaskId === task.id, 'is-active': isActive(task) }"
        @click="emit('taskSelect', task)"
      >
        <button
          class="pomodoro-btn"
          :class="{ running: isActive(task) && running }"
          @click.stop="handleStartTask(task)"
          :title="isActive(task) && running ? '暂停' : isActive(task) ? '继续' : '开始番茄钟'"
        >
          <span v-if="isActive(task) && running">⏸</span>
          <span v-else-if="isActive(task) && !running">▶</span>
          <span v-else>🍅</span>
        </button>

        <div class="task-content">
          <span class="task-title">{{ task.title }}</span>
          <span v-if="isActive(task)" class="task-timer" :class="phase">
            {{ phaseLabel(task) }}
          </span>
        </div>

        <div class="task-meta">
          <span v-if="task.pomodoroCount > 0" class="pomodoro-count">🍅×{{ task.pomodoroCount }}</span>
          <button class="delete-btn" @click.stop="deleteTask(task.id)" title="删除">✕</button>
        </div>
      </div>

      <!-- 已完成 -->
      <div v-if="completedTasks.length > 0" class="completed-section">
        <div class="completed-header">已完成 ({{ completedTasks.length }})</div>
        <div
          v-for="task in completedTasks"
          :key="task.id"
          class="task-row completed"
          @click="emit('taskSelect', task)"
        >
          <span class="check-icon">✓</span>
          <span class="task-title-done">{{ task.title }}</span>
          <span v-if="task.pomodoroCount > 0" class="pomodoro-count">🍅×{{ task.pomodoroCount }}</span>
        </div>
      </div>

      <div v-if="filteredTasks.length === 0 && completedTasks.length === 0" class="empty-state">
        暂无任务，添加一个开始专注吧
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid rgba(255,255,255,0.06);
}

.stats-bar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #e85d3a;
  line-height: 1.1;
}

.stat-label {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin-top: 2px;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: rgba(255,255,255,0.1);
  margin: 0 16px;
}

.add-task {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.add-input {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 8px 12px;
  color: #e8e8ea;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.add-input::placeholder {
  color: rgba(255,255,255,0.3);
}

.add-input:focus {
  border-color: rgba(232,93,58,0.5);
}

.add-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: #e85d3a;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.add-btn:hover { opacity: 0.85; }

.task-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 8px;
}

.task-list::-webkit-scrollbar { width: 4px; }
.task-list::-webkit-scrollbar-track { background: transparent; }
.task-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

.task-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
  margin-bottom: 2px;
}

.task-row:hover { background: rgba(255,255,255,0.05); }
.task-row.selected { background: rgba(232,93,58,0.12); }
.task-row.is-active { background: rgba(232,93,58,0.08); }

.pomodoro-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1.5px solid rgba(255,255,255,0.15);
  background: transparent;
  color: rgba(255,255,255,0.6);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}

.pomodoro-btn:hover {
  border-color: #e85d3a;
  color: #e85d3a;
  background: rgba(232,93,58,0.12);
}

.pomodoro-btn.running {
  border-color: #e85d3a;
  color: #e85d3a;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(232,93,58,0.4); }
  50% { box-shadow: 0 0 0 5px rgba(232,93,58,0); }
}

.task-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-title {
  font-size: 13px;
  color: rgba(255,255,255,0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-timer {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.task-timer.focus { color: #e85d3a; }
.task-timer.break { color: #3a9e6e; }

.task-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.pomodoro-count {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
}

.delete-btn {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.25);
  font-size: 11px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s, background 0.12s, color 0.12s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-row:hover .delete-btn { opacity: 1; }
.delete-btn:hover { background: rgba(220,60,60,0.2); color: #f87171; }

.completed-section {
  margin-top: 12px;
}

.completed-header {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  padding: 4px 10px 8px;
  letter-spacing: 0.04em;
}

.task-row.completed {
  opacity: 0.5;
}

.check-icon {
  width: 30px;
  text-align: center;
  color: #3a9e6e;
  font-size: 14px;
  flex-shrink: 0;
}

.task-title-done {
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  text-decoration: line-through;
  flex: 1;
}

.empty-state {
  text-align: center;
  color: rgba(255,255,255,0.25);
  font-size: 13px;
  padding: 40px 20px;
}
</style>
