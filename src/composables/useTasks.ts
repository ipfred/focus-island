import { ref, watch, computed } from 'vue'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'

export type TaskCategory = 'today' | 'tomorrow' | 'week'

export interface Task {
  id: string
  title: string
  note: string
  category: TaskCategory
  completed: boolean
  pomodoroCount: number
  createdAt: number
  updatedAt: number
}

const TASKS_FILE = 'pomodoro-island/tasks.json'

const tasks = ref<Task[]>([])
const loaded = ref(false)

async function load() {
  try {
    const raw = await readTextFile(TASKS_FILE, { baseDir: BaseDirectory.AppData })
    const parsed = JSON.parse(raw)
    // 兼容旧数据：补全缺失字段
    tasks.value = parsed.map((t: Omit<Task, 'note' | 'category'> & Partial<Task>) => ({
      note: t.note ?? '',
      category: t.category ?? ('today' as TaskCategory),
      ...t,
    } as Task))
  } catch {
    tasks.value = []
  }
  loaded.value = true
}

async function save() {
  if (!loaded.value) return
  try {
    await mkdir('pomodoro-island', { baseDir: BaseDirectory.AppData, recursive: true })
    await writeTextFile(TASKS_FILE, JSON.stringify(tasks.value), { baseDir: BaseDirectory.AppData })
  } catch (e) {
    console.error('Failed to save tasks', e)
  }
}

watch(tasks, save, { deep: true })

export function useTasks() {
  if (!loaded.value) load()

  function addTask(title: string, category: TaskCategory = 'today') {
    const now = Date.now()
    tasks.value.unshift({
      id: crypto.randomUUID(),
      title: title.trim(),
      note: '',
      category,
      completed: false,
      pomodoroCount: 0,
      createdAt: now,
      updatedAt: now,
    })
  }

  function updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'note' | 'category' | 'completed'>>) {
    const t = tasks.value.find(t => t.id === id)
    if (t) {
      Object.assign(t, patch)
      t.updatedAt = Date.now()
    }
  }

  function deleteTask(id: string) {
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  function toggleComplete(id: string) {
    const t = tasks.value.find(t => t.id === id)
    if (t) {
      t.completed = !t.completed
      t.updatedAt = Date.now()
    }
  }

  function incrementPomodoro(id: string) {
    const t = tasks.value.find(t => t.id === id)
    if (t) t.pomodoroCount++
  }

  const activeTasks = computed(() => tasks.value.filter(t => !t.completed))

  const todayTasks = computed(() =>
    tasks.value.filter(t => !t.completed && t.category === 'today')
  )
  const tomorrowTasks = computed(() =>
    tasks.value.filter(t => !t.completed && t.category === 'tomorrow')
  )
  const weekTasks = computed(() =>
    tasks.value.filter(t => !t.completed && t.category === 'week')
  )
  const completedTasks = computed(() => tasks.value.filter(t => t.completed))

  // 今日统计：已完成的番茄数 & 专注时长
  const todayStats = computed(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const ts = todayStart.getTime()
    const todayDone = tasks.value.filter(t => t.updatedAt >= ts && t.completed)
    const totalPomodoros = tasks.value.reduce((s, t) => s + t.pomodoroCount, 0)
    const focusMinutes = totalPomodoros * 25
    return { totalPomodoros, focusMinutes, completedToday: todayDone.length }
  })

  return {
    tasks,
    activeTasks,
    todayTasks,
    tomorrowTasks,
    weekTasks,
    completedTasks,
    todayStats,
    addTask,
    updateTask,
    deleteTask,
    toggleComplete,
    incrementPomodoro,
  }
}
