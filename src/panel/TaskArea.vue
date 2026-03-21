<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTasks } from '../composables/useTasks'
import { useTimerBridge } from '../composables/useTimerBridge'
import type { Task, TaskCategory } from '../composables/useTasks'

const props = defineProps<{
  category: TaskCategory
}>()

const emit = defineEmits<{ close: [], settings: [] }>()

const { tasks, addTask, deleteTask, toggleComplete, setTaskPriority, todayStats, incrementPomodoro } = useTasks()
const { start, pause, resume, running, activeTaskId, displayTime, abandon, skipToBreak } = useTimerBridge()

const newTitle = ref('')

const activeTasks = computed(() => tasks.value.filter(t => !t.completed && t.category === props.category))

const top3Tasks = computed(() => {
  return activeTasks.value.filter(t => t.priority > 0).sort((a, b) => a.priority - b.priority)
})

const inboxTasks = computed(() => {
  return activeTasks.value.filter(t => t.priority === 0)
})

// Input
async function handleInput(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    const t = newTitle.value.trim()
    if (!t) return
    
    // Add task
    const newTask = addTask(t, props.category, event.shiftKey ? 1 : undefined)
    newTitle.value = ''
    
    // Shift+Enter to start and close window
    if (event.shiftKey) {
      setTaskPriority(newTask.id, 1)
      start(newTask.id, newTask.title)
      emit('close')
    }
  }
}

// Timer Controls
function handleStartTask(task: Task) {
  if (activeTaskId.value === task.id) {
    if (running.value) pause()
    else resume()
  } else {
    start(task.id, task.title)
  }
}

function handleDoneTask(taskId: string) {
  if (activeTaskId.value === taskId) {
    incrementPomodoro(taskId)
    skipToBreak()
    toggleComplete(taskId)
  } else {
    toggleComplete(taskId)
  }
}

function handleAbandon() {
  abandon()
}

// Drag & Drop
const draggedTaskId = ref<string | null>(null)

function onDragStart(task: Task, event: DragEvent) {
  draggedTaskId.value = task.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
  }
}

function onDrop(targetTask: Task) {
  if (!draggedTaskId.value || draggedTaskId.value === targetTask.id) return
  setTaskPriority(draggedTaskId.value, targetTask.priority)
  draggedTaskId.value = null
}

function onDragEnd() {
  draggedTaskId.value = null
}
</script>

<template>
  <div class="dashboard">
    <!-- Zone 1: Global Input -->
    <div class="zone-1">
      <input
        class="quick-add-input"
        v-model="newTitle"
        placeholder="接下来专注做什么... (Shift+Enter 闪电开始)"
        @keydown="handleInput"
        autofocus
      />
    </div>

    <!-- Zone 2: Focus Queue (Top 3) -->
    <div class="zone-2">
      <div class="zone-header">核心专注区</div>
      <div v-if="top3Tasks.length === 0" class="empty-hint">暂无主打任务，输入后按回车添加</div>
      <div 
        v-for="(task, index) in top3Tasks" 
        :key="task.id"
        class="focus-task-item"
        :class="{ 'is-running-task': activeTaskId === task.id }"
        draggable="true"
        @dragstart="onDragStart(task, $event)"
        @dragover.prevent
        @dragenter.prevent
        @drop="onDrop(task)"
        @dragend="onDragEnd"
      >
        <!-- 正常态 -->
        <template v-if="!(activeTaskId === task.id && running)">
          <div class="task-row">
            <span class="rank-icon">
              {{ index === 0 ? '👑' : index === 1 ? '🥇' : '🥈' }}
            </span>
            <button class="check-circle" @click="handleDoneTask(task.id)" title="完成"></button>
            <span class="task-title">{{ task.title }}</span>
            <span class="pomo-count" v-if="task.pomodoroCount > 0">🍅x{{ task.pomodoroCount }}</span>
            <div class="task-actions">
              <button class="action-btn" @click="handleStartTask(task)" title="开始">▶</button>
              <button class="action-btn delete" @click="deleteTask(task.id)" title="删除">✕</button>
            </div>
          </div>
        </template>
        
        <!-- 运行态 -->
        <template v-else>
          <div class="task-row running">
            <span class="rank-icon running">●</span>
            <span class="task-title">{{ task.title }}</span>
            <span class="task-timer">{{ displayTime }}</span>
            <div class="task-actions">
              <button class="action-btn" @click="pause()" title="暂停">Ⅱ</button>
              <button class="action-btn" @click="handleDoneTask(task.id)" title="完成">✓</button>
              <button class="action-btn delete" @click="handleAbandon()" title="放弃">↷</button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Zone 3: Inbox -->
    <div class="zone-3">
      <div class="zone-header">
        📥 稍后处理 ({{ inboxTasks.length }})
      </div>
      <div class="inbox-list">
        <div v-if="inboxTasks.length === 0" class="empty-hint">收件箱为空</div>
        <div 
          v-for="task in inboxTasks" 
          :key="task.id"
          class="inbox-item"
        >
          <span class="inbox-dot">·</span>
          <span class="inbox-title">{{ task.title }}</span>
          <div class="inbox-actions">
            <button class="action-btn" @click="setTaskPriority(task.id, 3)" title="移至专注区">⬆️</button>
            <button class="action-btn" @click="toggleComplete(task.id)" title="完成">✅</button>
            <button class="action-btn delete" @click="deleteTask(task.id)" title="删除">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Zone 4: Footer -->
    <div class="zone-4">
      <div class="footer-stats">
        🍅 今日专注: {{ todayStats.completedToday }} 个任务 (约 {{ todayStats.focusMinutes }} 分钟)
      </div>
      <button class="footer-settings" title="设置" @click="emit('settings')">⚙️</button>
    </div>
  </div>
</template>

<style scoped>
/* Base Panel UI */
.dashboard {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
  color: #e8e8ea;
}

.zone-1 {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.quick-add-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px 16px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.quick-add-input:focus {
  border-color: color-mix(in srgb, var(--focus-color) 60%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus-color) 20%, transparent);
}

.quick-add-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.zone-header {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 8px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.empty-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  padding: 8px 0;
}

.zone-2 {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.focus-task-item {
  background: rgba(255, 255, 255, 0.035);
  border-radius: 12px;
  margin-bottom: 6px;
  padding: 6px 10px;
  transition: all 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: grab;
}

.focus-task-item:active {
  cursor: grabbing;
}

.focus-task-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}

.focus-task-item.is-running-task {
  background: color-mix(in srgb, var(--focus-color) 8%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 28%, transparent);
}

.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
}

.task-row.running .task-title {
  color: #fff;
  font-weight: 600;
}

.check-circle {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.28);
  background: transparent;
  cursor: pointer;
  padding: 0;
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
}

.pomo-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.task-timer {
  font-size: 12px;
  font-weight: 700;
  color: var(--focus-color);
  font-variant-numeric: tabular-nums;
}

.task-actions {
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.2s;
}

.focus-task-item:hover .task-actions {
  opacity: 1;
}

.action-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.8);
  transition: background 0.2s, color 0.2s, border-color 0.2s;
  padding: 2px 5px;
  border-radius: 6px;
  min-width: 22px;
  text-align: center;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.action-btn.delete {
  color: rgba(255, 255, 255, 0.6);
}

.rank-icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35));
}

.rank-icon.running {
  font-size: 10px;
  color: var(--focus-color);
  filter: none;
}

/* Zone 3: Inbox */
.zone-3 {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.zone-3::-webkit-scrollbar { width: 4px; }
.zone-3::-webkit-scrollbar-track { background: transparent; }
.zone-3::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

.inbox-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.inbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background 0.2s;
  cursor: default;
}

.inbox-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.inbox-dot {
  color: rgba(255, 255, 255, 0.3);
  font-weight: bold;
}

.inbox-title {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.inbox-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.inbox-item:hover .inbox-actions {
  opacity: 1;
}

/* Zone 4: Footer */
.zone-4 {
  padding: 12px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.footer-stats {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.footer-settings {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
  cursor: pointer;
  transition: color 0.2s;
}

.footer-settings:hover {
  color: #fff;
}
</style>
