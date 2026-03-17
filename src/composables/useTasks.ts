import { ref, watch } from 'vue'
import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'

export interface Task {
  id: string
  title: string
  completed: boolean
  pomodoroCount: number
  createdAt: number
}

const TASKS_FILE = 'pomodoro-island/tasks.json'

const tasks = ref<Task[]>([])
const loaded = ref(false)

async function load() {
  try {
    const raw = await readTextFile(TASKS_FILE, { baseDir: BaseDirectory.AppData })
    tasks.value = JSON.parse(raw)
  } catch {
    tasks.value = []
  }
  loaded.value = true
}

async function save() {
  if (!loaded.value) return
  try {
    await writeTextFile(TASKS_FILE, JSON.stringify(tasks.value), { baseDir: BaseDirectory.AppData })
  } catch (e) {
    console.error('Failed to save tasks', e)
  }
}

watch(tasks, save, { deep: true })

export function useTasks() {
  if (!loaded.value) load()

  function addTask(title: string) {
    tasks.value.unshift({
      id: crypto.randomUUID(),
      title: title.trim(),
      completed: false,
      pomodoroCount: 0,
      createdAt: Date.now(),
    })
  }

  function deleteTask(id: string) {
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  function toggleComplete(id: string) {
    const t = tasks.value.find(t => t.id === id)
    if (t) t.completed = !t.completed
  }

  function incrementPomodoro(id: string) {
    const t = tasks.value.find(t => t.id === id)
    if (t) t.pomodoroCount++
  }

  const activeTasks = computed(() => tasks.value.filter(t => !t.completed))

  return { tasks, activeTasks, addTask, deleteTask, toggleComplete, incrementPomodoro }
}

import { computed } from 'vue'
