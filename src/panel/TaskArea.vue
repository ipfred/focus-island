<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTasks } from '../composables/useTasks'
import { useTimerBridge } from '../composables/useTimerBridge'
import type { Task, TaskCategory } from '../composables/useTasks'

const props = defineProps<{
  category: TaskCategory
}>()

const emit = defineEmits<{ close: [] }>()

const { tasks, addTask, deleteTask, toggleComplete, setTaskPriority, todayStats } = useTasks()
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
          <div class="task-info-row">
            <div class="task-prefix">
              <span class="crown-icon" v-if="index === 0">👑</span>
              <span class="silver-icon" v-else>🥈</span>
              <button class="check-box" @click="handleDoneTask(task.id)"></button>
            </div>
            
            <span class="task-title" :class="{'is-main': index === 0}">{{ task.title }}</span>
            <span class="pomo-count" v-if="task.pomodoroCount > 0">🍅x{{ task.pomodoroCount }}</span>
            
            <div class="task-actions">
              <button class="action-btn" @click="handleStartTask(task)" title="开始番茄钟">▶️</button>
              <button class="action-btn delete" @click="deleteTask(task.id)" title="删除">🗑️</button>
            </div>
          </div>
        </template>
        
        <!-- 运行态控制台 -->
        <template v-else>
          <div class="running-console">
            <div class="running-timer">
              <span class="timer-icon">⏱️</span> 正在专注：<span class="timer-time">{{ displayTime }}</span>
            </div>
            <div class="running-title">{{ task.title }}</div>
            <div class="running-controls">
              <button class="ctrl-btn" @click="pause()">⏸️ 暂停</button>
              <button class="ctrl-btn" @click="handleDoneTask(task.id)">⏹️ 提前完成</button>
              <button class="ctrl-btn danger" @click="handleAbandon()">⏭️ 放弃</button>
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
      <button class="footer-settings" title="设置">⚙️</button>
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
  border-color: rgba(232, 93, 58, 0.6);
  box-shadow: 0 0 0 2px rgba(232, 93, 58, 0.2);
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
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.focus-task-item {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  margin-bottom: 8px;
  padding: 12px 16px;
  transition: all 0.2s;
  border: 1px solid transparent;
  cursor: grab;
}

.focus-task-item:active {
  cursor: grabbing;
}

.focus-task-item:hover {
  background: rgba(255, 255, 255, 0.07);
}

.focus-task-item.is-running-task {
  background: rgba(232, 93, 58, 0.08);
  border-color: rgba(232, 93, 58, 0.3);
}

.task-info-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-prefix {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 48px;
  flex-shrink: 0;
}

.crown-icon, .silver-icon {
  font-size: 14px;
}

.check-box {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: border-color 0.2s, background 0.2s;
}

.check-box:hover {
  border-color: #3a9e6e;
  background: rgba(58, 158, 110, 0.2);
}

.task-title {
  flex: 1;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-title.is-main {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.pomo-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
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
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.7;
  transition: opacity 0.2s;
  padding: 4px;
}

.action-btn:hover {
  opacity: 1;
}

.action-btn.delete {
  font-size: 13px;
}

/* Running Console */
.running-console {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  cursor: default;
}

.running-timer {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.timer-time {
  font-size: 24px;
  font-weight: 700;
  color: #e85d3a;
  font-variant-numeric: tabular-nums;
  margin-left: 8px;
}

.running-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.running-controls {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}

.ctrl-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.ctrl-btn.danger:hover {
  background: rgba(220, 60, 60, 0.2);
  border-color: rgba(220, 60, 60, 0.4);
  color: #f87171;
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
