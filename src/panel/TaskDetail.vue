<script setup lang="ts">
import { ref, watch } from 'vue'
import { useTasks } from '../composables/useTasks'
import type { Task } from '../composables/useTasks'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ close: [] }>()

const { updateTask, deleteTask } = useTasks()

const editTitle = ref(props.task.title)
const editNote = ref(props.task.note)

// 当选中任务切换时同步
watch(() => props.task, (t) => {
  editTitle.value = t.title
  editNote.value = t.note
})

function saveTitle() {
  const t = editTitle.value.trim()
  if (t && t !== props.task.title) {
    updateTask(props.task.id, { title: t })
  } else {
    editTitle.value = props.task.title
  }
}

function saveNote() {
  updateTask(props.task.id, { note: editNote.value })
}

function handleDelete() {
  deleteTask(props.task.id)
  emit('close')
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="task-detail">
    <div class="detail-header">
      <span class="detail-title-label">任务详情</span>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>

    <div class="detail-body">
      <!-- 标题编辑 -->
      <div class="field-group">
        <label class="field-label">标题</label>
        <input
          v-model="editTitle"
          class="detail-input"
          maxlength="80"
          @blur="saveTitle"
          @keydown.enter="saveTitle"
        />
      </div>

      <!-- 备注 -->
      <div class="field-group">
        <label class="field-label">备注</label>
        <textarea
          v-model="editNote"
          class="detail-textarea"
          placeholder="添加备注..."
          rows="5"
          @blur="saveNote"
        />
      </div>

      <!-- 番茄统计 -->
      <div class="field-group">
        <label class="field-label">番茄记录</label>
        <div class="pomodoro-dots">
          <span
            v-for="i in Math.max(props.task.pomodoroCount, 1)"
            :key="i"
            class="dot"
            :class="{ filled: i <= props.task.pomodoroCount }"
          />
        </div>
        <span class="pomodoro-text">
          已完成 {{ props.task.pomodoroCount }} 个番茄（{{ props.task.pomodoroCount * 25 }} 分钟）
        </span>
      </div>

      <!-- 时间信息 -->
      <div class="field-group">
        <label class="field-label">创建时间</label>
        <span class="field-value">{{ formatDate(props.task.createdAt) }}</span>
      </div>

      <div class="field-group">
        <label class="field-label">更新时间</label>
        <span class="field-value">{{ formatDate(props.task.updatedAt) }}</span>
      </div>
    </div>

    <div class="detail-footer">
      <button class="toggle-btn" @click="updateTask(props.task.id, { completed: !props.task.completed })">
        {{ props.task.completed ? '标记未完成' : '标记完成' }}
      </button>
      <button class="delete-btn" @click="handleDelete">删除任务</button>
    </div>
  </div>
</template>

<style scoped>
.task-detail {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: rgba(14, 14, 18, 0.95);
  border-left: 1px solid rgba(255,255,255,0.06);
  overflow: hidden;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.detail-title-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.close-btn {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.35);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.8);
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-body::-webkit-scrollbar { width: 3px; }
.detail-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.35);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.detail-input {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 7px;
  padding: 8px 10px;
  color: #e8e8ea;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.detail-input:focus {
  border-color: rgba(232,93,58,0.5);
}

.detail-textarea {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 7px;
  padding: 8px 10px;
  color: #e8e8ea;
  font-size: 13px;
  outline: none;
  resize: none;
  line-height: 1.5;
  transition: border-color 0.15s;
  font-family: inherit;
}

.detail-textarea:focus {
  border-color: rgba(232,93,58,0.5);
}

.detail-textarea::placeholder {
  color: rgba(255,255,255,0.25);
}

.pomodoro-dots {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid rgba(255,255,255,0.2);
  background: transparent;
}

.dot.filled {
  background: #e85d3a;
  border-color: #e85d3a;
}

.pomodoro-text {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
}

.field-value {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
}

.detail-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.toggle-btn, .delete-btn {
  padding: 8px;
  border-radius: 7px;
  border: none;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.15s;
}

.toggle-btn {
  background: rgba(58, 158, 110, 0.25);
  color: #3a9e6e;
}

.toggle-btn:hover { opacity: 0.8; }

.delete-btn {
  background: rgba(220, 60, 60, 0.15);
  color: #f87171;
}

.delete-btn:hover { opacity: 0.8; }

/* 进入/退出动画 */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>
