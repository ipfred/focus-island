<script setup lang="ts">
import { ref } from 'vue'
import { useTasks } from '../composables/useTasks'

const { tasks, addTask, deleteTask, toggleComplete } = useTasks()
const newTaskTitle = ref('')

function handleAdd() {
  const title = newTaskTitle.value.trim()
  if (!title) return
  addTask(title)
  newTaskTitle.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') handleAdd()
}
</script>

<template>
  <div class="w-[360px] bg-[#111113] border border-white/10 rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
    <div class="text-white/60 text-xs font-semibold uppercase tracking-widest">Tasks</div>

    <!-- Add task input -->
    <div class="flex gap-2">
      <input
        v-model="newTaskTitle"
        @keydown="handleKeydown"
        class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-[var(--idle-color)] placeholder:text-white/20"
        placeholder="New task…"
        maxlength="80"
      />
      <button
        @click="handleAdd"
        class="shrink-0 bg-[var(--idle-color)] hover:opacity-80 text-white text-sm px-3 py-1.5 rounded-lg transition-opacity"
      >Add</button>
    </div>

    <!-- Task list -->
    <div class="flex flex-col gap-1 max-h-64 overflow-y-auto">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 group transition-colors"
      >
        <button
          @click="toggleComplete(task.id)"
          class="shrink-0 w-4 h-4 rounded-full border transition-colors"
          :class="task.completed ? 'bg-[var(--break-color)] border-[var(--break-color)]' : 'border-white/30 hover:border-white/60'"
        />
        <span
          class="flex-1 text-sm truncate transition-opacity"
          :class="task.completed ? 'text-white/30 line-through' : 'text-white'"
        >{{ task.title }}</span>
        <span class="text-white/30 text-xs shrink-0">{{ task.pomodoroCount > 0 ? `x${task.pomodoroCount}` : '' }}</span>
        <button
          @click="deleteTask(task.id)"
          class="shrink-0 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xs transition-all"
        >x</button>
      </div>
      <div v-if="tasks.length === 0" class="text-white/20 text-xs text-center py-4">
        No tasks yet
      </div>
    </div>
  </div>
</template>
