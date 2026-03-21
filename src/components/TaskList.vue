<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useTasks } from '../composables/useTasks'
import { useTimer } from '../composables/useTimer'

const { tasks, addTask, updateTask, deleteTask, toggleComplete } = useTasks()
const { start, activeTaskId } = useTimer()

const newTaskTitle = ref('')
const editingId = ref<string | null>(null)
const editingTitle = ref('')
const editInput = ref<HTMLInputElement | null>(null)

const totalMinutes = computed(() => {
  return tasks.value.reduce((sum, t) => sum + t.pomodoroCount * 25, 0)
})

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return d.getFullYear() === now.getFullYear() ? `${m}-${day}` : `${d.getFullYear()}-${m}-${day}`
}

function handleAdd() {
  const title = newTaskTitle.value.trim()
  if (!title) return
  addTask(title)
  newTaskTitle.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') handleAdd()
}

function startTask(taskId: string, title: string) {
  start(taskId, title)
}

async function startEdit(task: { id: string; title: string }) {
  editingId.value = task.id
  editingTitle.value = task.title
  await nextTick()
  editInput.value?.focus()
  editInput.value?.select()
}

function confirmEdit() {
  if (editingId.value && editingTitle.value.trim()) {
    updateTask(editingId.value, { title: editingTitle.value })
  }
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

function handleEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') confirmEdit()
  if (e.key === 'Escape') cancelEdit()
}
</script>

<template>
  <div class="w-[400px] bg-[#111113] border border-white/10 rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="text-white/70 text-sm font-medium">
        任务 · <span class="text-white/40">{{ totalMinutes }}分钟</span>
      </div>
    </div>

    <!-- Task list -->
    <div class="flex flex-col gap-2 max-h-72 overflow-y-auto">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] group transition-colors"
      >
        <!-- Checkbox -->
        <button
          @click="toggleComplete(task.id)"
          class="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
          :class="task.completed
            ? 'bg-[var(--break-color)] border-[var(--break-color)]'
            : 'border-white/25 hover:border-white/50'"
        >
          <svg v-if="task.completed" class="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Play button -->
        <button
          v-if="!task.completed"
          @click="startTask(task.id, task.title)"
          class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all"
          :class="activeTaskId === task.id
            ? 'bg-[var(--focus-color)]'
            : 'bg-[var(--focus-color)]/80 hover:bg-[var(--focus-color)]'"
        >
          <svg class="w-3 h-3 text-white ml-0.5" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 1.5v9l7.5-4.5L3 1.5z"/>
          </svg>
        </button>

        <!-- Task content: title + date -->
        <div class="flex-1 min-w-0" @dblclick="startEdit(task)">
          <template v-if="editingId === task.id">
            <input
              ref="editInput"
              v-model="editingTitle"
              @blur="confirmEdit"
              @keydown="handleEditKeydown"
              class="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-0.5 text-white text-sm outline-none focus:border-white/40 transition-colors"
              maxlength="80"
            />
          </template>
          <template v-else>
            <div
              class="text-sm truncate cursor-text"
              :class="task.completed ? 'text-white/30 line-through' : 'text-white'"
            >{{ task.title }}</div>
            <div class="text-[11px] text-white/25 mt-0.5">
              {{ formatDate(task.updatedAt || task.createdAt) }}
            </div>
          </template>
        </div>

        <!-- Pomodoro count -->
        <span v-if="task.pomodoroCount > 0" class="text-white/30 text-xs shrink-0">
          {{ task.pomodoroCount }}x🍅
        </span>

        <!-- Delete -->
        <button
          @click="deleteTask(task.id)"
          class="shrink-0 w-5 h-5 flex items-center justify-center text-white/0 group-hover:text-white/30 hover:!text-red-400 text-xs transition-all"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M3 3l8 8M11 3l-8 8"/>
          </svg>
        </button>
      </div>

      <div v-if="tasks.length === 0" class="text-white/20 text-sm text-center py-6">
        暂无任务
      </div>
    </div>

    <!-- Add task input -->
    <div class="flex gap-2 pt-1">
      <input
        v-model="newTaskTitle"
        @keydown="handleKeydown"
        class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-white/25 placeholder:text-white/20 transition-colors"
        placeholder="添加新任务…"
        maxlength="80"
      />
      <button
        @click="handleAdd"
        class="shrink-0 bg-white/10 hover:bg-white/15 text-white/70 text-sm px-4 py-2 rounded-xl transition-colors"
      >添加</button>
    </div>
  </div>
</template>
