<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useTasks, type Task } from '../composables/useTasks'
import { useTaskGroups } from '../composables/useTaskGroups'
import { useTimerBridge } from '../composables/useTimerBridge'
import { getCategoryColor } from '../composables/useMemos'

const props = defineProps<{ taskId: string }>()
const emit = defineEmits<{ back: [] }>()

const {
  tasks,
  updateTask,
  deleteTask,
  toggleComplete,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
} = useTasks()
const { groups } = useTaskGroups()
const {
  start,
  pause,
  resume,
  running,
  activeTaskId,
  displayTime,
  phase,
  abandon,
  setSubtaskContext,
  activeSubtaskId,
} = useTimerBridge()

// --- State ---
const editingTitle = ref(false)
const titleInput = ref('')
const showDatePicker = ref(false)
const showGroupDropdown = ref(false)
const showDeleteConfirm = ref(false)
const newSubtaskTitle = ref('')

// --- Computed ---
const task = computed<Task | undefined>(() => tasks.value.find(t => t.id === props.taskId))

const taskNotFound = computed(() => !task.value)

// --- Helpers ---
function formatDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplayDate(dateStr: string | null): string {
  if (!dateStr) return '无日期'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const diff = Math.floor((date.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  if (diff === -1) return '昨天'
  if (diff < -1) return `${Math.abs(diff)}天前`
  return `${m}月${d}日`
}

// --- Title editing ---
function startEditTitle() {
  if (!task.value) return
  titleInput.value = task.value.title
  editingTitle.value = true
}

function saveTitle() {
  if (!task.value) return
  const trimmed = titleInput.value.trim()
  if (trimmed) {
    updateTask(task.value.id, { title: trimmed })
  }
  editingTitle.value = false
}

function cancelEditTitle() {
  editingTitle.value = false
}

// --- Date picker ---
function setQuickDate(offset: number) {
  if (!task.value) return
  const d = new Date()
  d.setDate(d.getDate() + offset)
  updateTask(task.value.id, { dueDate: formatDateStr(d) })
  showDatePicker.value = false
}

function onCustomDateChange(e: Event) {
  if (!task.value) return
  const val = (e.target as HTMLInputElement).value
  if (val) {
    updateTask(task.value.id, { dueDate: val })
    showDatePicker.value = false
  }
}

// --- Group ---
function selectGroup(groupId: string | null) {
  if (!task.value) return
  updateTask(task.value.id, { groupId })
  showGroupDropdown.value = false
}

// --- Notes ---
function onNoteInput(e: Event) {
  if (!task.value) return
  const val = (e.target as HTMLTextAreaElement).value
  updateTask(task.value.id, { note: val })
}

// --- Subtasks ---
function handleAddSubtask() {
  if (!task.value) return
  const title = newSubtaskTitle.value.trim()
  if (!title) return
  addSubtask(task.value.id, title)
  newSubtaskTitle.value = ''
}

function handleStartSubtask(subtaskId: string, subtaskTitle: string) {
  if (!task.value) return
  setSubtaskContext(subtaskId, subtaskTitle)
  start(task.value.id, `${task.value.title} — ${subtaskTitle}`)
}

function handleStartTask() {
  if (!task.value) return
  setSubtaskContext(null, null)
  if (activeTaskId.value === task.value.id) {
    if (running.value) pause()
    else resume()
  } else {
    start(task.value.id, task.value.title)
  }
}

// --- Delete ---
function confirmDelete() {
  showDeleteConfirm.value = true
}

function doDelete() {
  if (!task.value) return
  if (activeTaskId.value === task.value.id) {
    abandon()
  }
  deleteTask(task.value.id)
  emit('back')
}

function cancelDelete() {
  showDeleteConfirm.value = false
}

// --- Click outside ---
function onClickOutside() {
  showDatePicker.value = false
  showGroupDropdown.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showDeleteConfirm.value) {
      showDeleteConfirm.value = false
    } else if (showDatePicker.value) {
      showDatePicker.value = false
    } else if (showGroupDropdown.value) {
      showGroupDropdown.value = false
    } else {
      emit('back')
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('click', onClickOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <div class="detail-page" @click="onClickOutside">
    <!-- Task not found -->
    <div v-if="taskNotFound" class="not-found">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
      <span class="not-found-text">任务不存在</span>
      <button class="not-found-btn" @click="emit('back')">返回</button>
    </div>

    <!-- Task detail -->
    <template v-else>
      <!-- Header -->
      <header class="detail-header">
        <button class="header-btn back-btn" @click.stop="emit('back')" title="返回">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span class="header-title">任务详情</span>
        <div class="header-spacer"></div>
      </header>

      <!-- Title row -->
      <div class="title-row">
        <button
          class="task-checkbox"
          :class="{ checked: task!.completed }"
          @click="toggleComplete(task!.id)"
        >
          <svg v-if="task!.completed" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
        </button>

        <div v-if="editingTitle" class="title-edit-wrapper" @click.stop>
          <input
            v-model="titleInput"
            class="title-edit-input"
            @keydown.enter="saveTitle"
            @keydown.escape="cancelEditTitle"
            @blur="saveTitle"
            autofocus
          />
        </div>
        <div v-else class="title-display" @click="startEditTitle">
          <span class="title-text" :class="{ 'line-through': task!.completed }">{{ task!.title }}</span>
          <svg class="edit-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </div>

        <!-- Pomodoro count -->
        <div class="pomodoro-count">
          🍅{{ task!.pomodoroCount }}
        </div>

        <!-- Timer or play button -->
        <div v-if="activeTaskId === task!.id && !activeSubtaskId" class="timer-inline" @click.stop>
          <span class="timer-phase-label">{{ phase === 'focus' ? '专注' : '休息' }}</span>
          <span class="timer-time-label">{{ displayTime }}</span>
          <button class="timer-ctrl-btn" :class="{ 'is-paused': !running }" @click.stop="running ? pause() : resume()" :title="running ? '暂停' : '继续'">
            <svg v-if="running" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>
          </button>
        </div>
        <button v-else class="play-btn" @click.stop="handleStartTask" title="开始专注">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>
        </button>
      </div>

      <!-- Properties -->
      <div class="prop-section">
        <!-- Due date -->
        <div class="prop-row" @click.stop>
          <span class="prop-label">到期日</span>
          <div class="prop-value-wrapper">
            <button class="prop-value-btn date-btn" :class="{ active: showDatePicker }" @click.stop="showDatePicker = !showDatePicker; showGroupDropdown = false">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>{{ task!.dueDate ? formatDisplayDate(task!.dueDate) : '无日期' }}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div v-if="showDatePicker" class="dropdown-menu" @click.stop>
              <button class="dropdown-item" @click="setQuickDate(0)">今天</button>
              <button class="dropdown-item" @click="setQuickDate(1)">明天</button>
              <button class="dropdown-item" @click="setQuickDate(2)">后天</button>
              <label class="dropdown-item custom-date-label">
                自定义
                <input type="date" :value="task!.dueDate ?? ''" @change="onCustomDateChange" />
              </label>
            </div>
          </div>
        </div>

        <!-- Group -->
        <div class="prop-row" @click.stop>
          <span class="prop-label">分组</span>
          <div class="prop-value-wrapper">
            <button class="prop-value-btn group-btn" :class="{ active: showGroupDropdown }" @click.stop="showGroupDropdown = !showGroupDropdown; showDatePicker = false">
              <span
                v-if="task!.groupId && groups.find(g => g.id === task!.groupId)"
                class="group-dot"
                :style="{ backgroundColor: getCategoryColor(groups.find(g => g.id === task!.groupId)!.color).icon }"
              ></span>
              <span>{{ task!.groupId ? (groups.find(g => g.id === task!.groupId)?.name ?? '无分组') : '无分组' }}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div v-if="showGroupDropdown" class="dropdown-menu" @click.stop>
              <button class="dropdown-item" :class="{ active: !task!.groupId }" @click="selectGroup(null)">
                无分组
              </button>
              <button
                v-for="group in groups"
                :key="group.id"
                class="dropdown-item"
                :class="{ active: task!.groupId === group.id }"
                @click="selectGroup(group.id)"
              >
                <span class="group-dot" :style="{ backgroundColor: getCategoryColor(group.color).icon }"></span>
                {{ group.name }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="note-section">
        <div class="section-label">备注</div>
        <textarea
          class="note-textarea"
          :value="task!.note"
          @input="onNoteInput"
          placeholder="添加备注..."
          rows="4"
        ></textarea>
      </div>

      <!-- Subtasks -->
      <div class="subtask-section">
        <div class="section-label-row">
          <span class="section-label">子任务</span>
          <button class="add-subtask-btn" @click.stop>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            添加
          </button>
        </div>

        <!-- Subtask list -->
        <div v-if="task!.subtasks.length > 0" class="subtask-list">
          <div
            v-for="sub in task!.subtasks"
            :key="sub.id"
            class="subtask-row"
            :class="{ 'is-active-sub': activeSubtaskId === sub.id, completed: sub.completed }"
          >
            <button
              class="subtask-checkbox"
              :class="{ checked: sub.completed }"
              @click.stop="toggleSubtask(task!.id, sub.id)"
            >
              <svg v-if="sub.completed" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
            </button>
            <span class="subtask-title" :class="{ 'line-through': sub.completed }">{{ sub.title }}</span>
            <span v-if="sub.pomodoroCount > 0" class="subtask-pomodoro">🍅{{ sub.pomodoroCount }}</span>
            <button
              class="subtask-play-btn"
              :class="{ active: activeSubtaskId === sub.id }"
              @click.stop="handleStartSubtask(sub.id, sub.title)"
              title="开始子任务"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>
            </button>
            <button class="subtask-delete-btn" @click.stop="deleteSubtask(task!.id, sub.id)" title="删除子任务">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <!-- Add subtask -->
        <div class="subtask-add" @click.stop>
          <input
            v-model="newSubtaskTitle"
            class="subtask-add-input"
            placeholder="添加子任务..."
            @keydown.enter="handleAddSubtask"
            @click.stop
          />
        </div>
      </div>

      <!-- Timer on subtask indicator -->
      <div v-if="activeSubtaskId && task!.subtasks.some(s => s.id === activeSubtaskId)" class="subtask-timer-bar" @click.stop>
        <span class="subtask-timer-name">{{ task!.subtasks.find(s => s.id === activeSubtaskId)?.title }}</span>
        <span class="timer-phase-label">{{ phase === 'focus' ? '专注' : '休息' }}</span>
        <span class="timer-time-label">{{ displayTime }}</span>
        <div class="subtask-timer-controls">
          <button class="timer-ctrl-btn" :class="{ 'is-paused': !running }" @click.stop="running ? pause() : resume()" :title="running ? '暂停' : '继续'">
            <svg v-if="running" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>
          </button>
          <button class="timer-ctrl-btn stop-btn" @click.stop="abandon()" title="停止">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
          </button>
        </div>
      </div>

      <!-- Delete button -->
      <div class="delete-section">
        <button v-if="!showDeleteConfirm" class="delete-btn" @click="confirmDelete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
          删除任务
        </button>
        <div v-else class="delete-confirm" @click.stop>
          <span class="delete-confirm-text">确定删除？</span>
          <button class="delete-confirm-btn danger" @click="doDelete">删除</button>
          <button class="delete-confirm-btn" @click="cancelDelete">取消</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
@reference "../styles.css";

.detail-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.detail-page::-webkit-scrollbar { width: 4px; }
.detail-page::-webkit-scrollbar-track { background: transparent; }
.detail-page::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

/* Not found */
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 100%;
  padding: 40px 20px;
}

.not-found-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
}

.not-found-btn {
  padding: 6px 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.not-found-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

/* Header */
.detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.header-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.header-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.header-title {
  flex: 1;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.95);
}

.header-spacer {
  width: 30px;
}

/* Title row */
.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.task-checkbox {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: transparent;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  padding: 0;
}

.task-checkbox:hover {
  border-color: color-mix(in srgb, var(--focus-color) 60%, transparent);
  background: color-mix(in srgb, var(--focus-color) 10%, transparent);
}

.task-checkbox.checked {
  border-color: color-mix(in srgb, var(--focus-color) 70%, transparent);
  background: color-mix(in srgb, var(--focus-color) 25%, transparent);
  color: var(--focus-color);
}

.title-display {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: text;
  min-width: 0;
  padding: 4px 0;
}

.title-text {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-text.line-through {
  text-decoration: line-through;
  color: rgba(255, 255, 255, 0.35);
}

.edit-icon {
  opacity: 0;
  color: rgba(255, 255, 255, 0.35);
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.title-display:hover .edit-icon {
  opacity: 1;
}

.title-edit-wrapper {
  flex: 1;
  min-width: 0;
}

.title-edit-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid color-mix(in srgb, var(--focus-color) 40%, transparent);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  outline: none;
  font-family: inherit;
}

.pomodoro-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
  white-space: nowrap;
}

/* Timer display for main task */
.timer-inline {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--focus-color) 10%, rgba(28, 28, 32, 0.8));
  border: 1px solid color-mix(in srgb, var(--focus-color) 25%, transparent);
  flex-shrink: 0;
}

.timer-phase-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--focus-color);
  letter-spacing: 0.05em;
}

.timer-time-label {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
  min-width: 38px;
  text-align: center;
}

.timer-ctrl-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  padding: 0;
}

.timer-ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.timer-ctrl-btn.is-paused {
  background: color-mix(in srgb, var(--focus-color) 20%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 40%, transparent);
  color: var(--focus-color);
}

.timer-ctrl-btn.stop-btn:hover {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.3);
  color: #f87171;
}

.play-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--focus-color) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--focus-color) 30%, transparent);
  color: var(--focus-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  padding: 0;
}

.play-btn:hover {
  background: color-mix(in srgb, var(--focus-color) 30%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 50%, transparent);
  transform: scale(1.08);
}

/* Properties section */
.prop-section {
  padding: 6px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.prop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
}

.prop-row + .prop-row {
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.prop-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  flex-shrink: 0;
  min-width: 48px;
}

.prop-value-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  justify-content: flex-end;
}

.prop-value-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  white-space: nowrap;
}

.prop-value-btn:hover,
.prop-value-btn.active {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.9);
}

.group-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Dropdown menu (shared) */
.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 50;
  min-width: 130px;
  padding: 4px;
  border-radius: 10px;
  background: rgba(28, 28, 32, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  margin-top: 4px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  text-align: left;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.dropdown-item.active {
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  color: var(--focus-color);
}

.custom-date-label {
  position: relative;
  justify-content: space-between;
}

.custom-date-label input[type="date"] {
  position: absolute;
  right: 4px;
  width: 20px;
  opacity: 0;
  cursor: pointer;
}

/* Notes section */
.note-section {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.section-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.section-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.note-textarea {
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
  outline: none;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-height: 80px;
}

.note-textarea:focus {
  border-color: color-mix(in srgb, var(--focus-color) 40%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus-color) 10%, transparent);
}

.note-textarea::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

/* Subtask section */
.subtask-section {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.add-subtask-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.add-subtask-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.7);
}

.subtask-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 6px;
}

.subtask-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-radius: 6px;
  transition: background 0.15s;
}

.subtask-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.subtask-row.is-active-sub {
  background: color-mix(in srgb, var(--focus-color) 8%, transparent);
}

.subtask-row.completed {
  opacity: 0.5;
}

.subtask-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: transparent;
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  padding: 0;
}

.subtask-checkbox:hover {
  border-color: color-mix(in srgb, var(--focus-color) 50%, transparent);
}

.subtask-checkbox.checked {
  border-color: color-mix(in srgb, var(--focus-color) 60%, transparent);
  background: color-mix(in srgb, var(--focus-color) 20%, transparent);
  color: var(--focus-color);
}

.subtask-title {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtask-title.line-through {
  text-decoration: line-through;
  color: rgba(255, 255, 255, 0.3);
}

.subtask-pomodoro {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.subtask-play-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
  padding: 0;
  opacity: 0;
}

.subtask-row:hover .subtask-play-btn {
  opacity: 1;
}

.subtask-play-btn:hover {
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 30%, transparent);
  color: var(--focus-color);
}

.subtask-play-btn.active {
  opacity: 1;
  background: color-mix(in srgb, var(--focus-color) 20%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 40%, transparent);
  color: var(--focus-color);
}

.subtask-delete-btn {
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
  transition: all 0.15s;
  flex-shrink: 0;
  padding: 0;
  opacity: 0;
}

.subtask-row:hover .subtask-delete-btn {
  opacity: 1;
}

.subtask-delete-btn:hover {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
}

.subtask-add {
  margin-top: 4px;
}

.subtask-add-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  outline: none;
  transition: all 0.2s;
  font-family: inherit;
}

.subtask-add-input::placeholder {
  color: rgba(255, 255, 255, 0.2);
}

.subtask-add-input:focus {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}

/* Subtask timer bar */
.subtask-timer-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: color-mix(in srgb, var(--focus-color) 6%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--focus-color) 12%, transparent);
}

.subtask-timer-name {
  flex: 1;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtask-timer-controls {
  display: flex;
  gap: 3px;
}

/* Delete section */
.delete-section {
  padding: 16px 14px 24px;
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 16px;
  border-radius: 8px;
  background: rgba(248, 113, 113, 0.06);
  border: 1px solid rgba(248, 113, 113, 0.15);
  color: rgba(248, 113, 113, 0.8);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.delete-btn:hover {
  background: rgba(248, 113, 113, 0.12);
  border-color: rgba(248, 113, 113, 0.3);
  color: #f87171;
}

.delete-confirm {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 8px;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.2);
}

.delete-confirm-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.delete-confirm-btn {
  padding: 4px 14px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.delete-confirm-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.delete-confirm-btn.danger {
  background: rgba(220, 38, 38, 0.25);
  border-color: rgba(220, 38, 38, 0.4);
  color: #fca5a5;
}

.delete-confirm-btn.danger:hover {
  background: rgba(220, 38, 38, 0.4);
  color: #fff;
}
</style>
