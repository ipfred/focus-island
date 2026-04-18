import { ref, watch, computed } from 'vue'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { emitTo, listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useSettings } from './useSettings'
import { useDailyStats } from './useDailyStats'

export type TaskCategory = 'today' | 'tomorrow' | 'week'
// 0=收件箱, 1=主任务, 2=次级A, 3=次级B
export type TaskPriority = 0 | 1 | 2 | 3

export interface Task {
  id: string
  title: string
  note: string
  category: TaskCategory
  completed: boolean
  pomodoroCount: number
  priority: TaskPriority
  createdAt: number
  updatedAt: number
}

const TASKS_FILE = 'focus-island/tasks.json'
const categories: TaskCategory[] = ['today', 'tomorrow', 'week']

const tasks = ref<Task[]>([])
const loaded = ref(false)

function normalizeCategory(category: TaskCategory) {
  const indexMap = new Map(tasks.value.map((task, index) => [task.id, index]))
  const scoped = tasks.value.filter(task => !task.completed && task.category === category)
  const orderedFocus = scoped
    .filter(task => task.priority > 0)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0)
    })

  scoped.forEach(task => {
    task.priority = 0
  })

  // Auto-fill from inbox when focus area has fewer than 3
  if (orderedFocus.length < 3) {
    const inbox = scoped
      .filter(task => !orderedFocus.includes(task))
      .sort((a, b) => a.createdAt - b.createdAt)
    while (orderedFocus.length < 3 && inbox.length > 0) {
      orderedFocus.push(inbox.shift()!)
    }
  }

  orderedFocus.slice(0, 3).forEach((task, index) => {
    task.priority = (index + 1) as TaskPriority
  })
}

function normalizeAllCategories() {
  categories.forEach(normalizeCategory)
}

function nextAvailablePriority(category: TaskCategory): TaskPriority {
  const used = new Set(
    tasks.value
      .filter(task => !task.completed && task.category === category && task.priority > 0)
      .map(task => task.priority),
  )

  for (const priority of [1, 2, 3] as const) {
    if (!used.has(priority)) return priority
  }

  return 0
}

async function load() {
  try {
    const raw = await readTextFile(TASKS_FILE, { baseDir: BaseDirectory.AppData })
    const parsed = JSON.parse(raw)
    tasks.value = parsed.map((t: Omit<Task, 'note' | 'category' | 'priority'> & Partial<Task>) => ({
      note: t.note ?? '',
      category: t.category ?? ('today' as TaskCategory),
      priority: t.completed ? 0 : ((t.priority ?? 0) as TaskPriority),
      ...t,
    } as Task))
    normalizeAllCategories()
  } catch {
    tasks.value = []
  }
  loaded.value = true
}

let isSyncing = false

async function save() {
  if (!loaded.value || isSyncing) return
  try {
    await mkdir('focus-island', { baseDir: BaseDirectory.AppData, recursive: true })
    const json = JSON.stringify(tasks.value)
    await writeTextFile(TASKS_FILE, json, { baseDir: BaseDirectory.AppData })
    // Broadcast to other windows
    const self = getCurrentWebviewWindow().label
    const targets = self === 'main' ? ['panel'] : ['main']
    for (const target of targets) {
      emitTo(target, 'tasks-updated', json).catch(() => {})
    }
  } catch (e) {
    console.error('Failed to save tasks', e)
  }
}

watch(tasks, save, { deep: true })

// Listen for cross-window task updates
listen<string>('tasks-updated', (event) => {
  try {
    isSyncing = true
    const parsed = JSON.parse(event.payload) as Task[]
    tasks.value = parsed
    // nextTick to let watch fire and skip save due to isSyncing
    setTimeout(() => { isSyncing = false }, 50)
  } catch { /* ignore */ }
})

export function useTasks() {
  if (!loaded.value) load()
  const { recordTaskCompleted } = useDailyStats()

  function addTask(title: string, category: TaskCategory = 'today', priority?: TaskPriority) {
    const now = Date.now()
    const task: Task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      note: '',
      category,
      completed: false,
      pomodoroCount: 0,
      priority: priority ?? nextAvailablePriority(category),
      createdAt: now,
      updatedAt: now,
    }

    tasks.value.unshift(task)
    normalizeCategory(category)
    return task
  }

  function updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'note' | 'category' | 'completed' | 'priority'>>) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return

    const wasCompleted = task.completed
    const prevCategory = task.category
    Object.assign(task, patch)

    if (task.completed) {
      task.priority = 0
    }
    if (!wasCompleted && task.completed) {
      recordTaskCompleted()
    }

    task.updatedAt = Date.now()
    normalizeCategory(prevCategory)
    if (task.category !== prevCategory) normalizeCategory(task.category)
  }

  function setTaskPriority(id: string, priority: TaskPriority) {
    const task = tasks.value.find(t => t.id === id)
    if (!task || task.completed) return

    const scoped = tasks.value.filter(t => !t.completed && t.category === task.category)
    const indexMap = new Map(tasks.value.map((item, index) => [item.id, index]))
    const orderedFocus = scoped
      .filter(t => t.id !== id && t.priority > 0)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0)
      })

    if (priority > 0) {
      orderedFocus.splice(priority - 1, 0, task)
    }

    scoped.forEach(t => {
      t.priority = 0
    })

    orderedFocus.slice(0, 3).forEach((item, index) => {
      item.priority = (index + 1) as TaskPriority
    })

    task.updatedAt = Date.now()
  }

  function deleteTask(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return

    const category = task.category
    tasks.value = tasks.value.filter(t => t.id !== id)
    normalizeCategory(category)
  }

  function toggleComplete(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return

    const wasCompleted = task.completed
    task.completed = !task.completed
    task.priority = task.completed ? 0 : nextAvailablePriority(task.category)
    if (!wasCompleted && task.completed) {
      recordTaskCompleted()
    }
    task.updatedAt = Date.now()
    normalizeCategory(task.category)
  }

  function incrementPomodoro(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (task) {
      task.pomodoroCount++
      task.updatedAt = Date.now()
    }
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

  const todayStats = computed(() => {
    const { settings } = useSettings()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const ts = todayStart.getTime()
    const todayDone = tasks.value.filter(t => t.updatedAt >= ts && t.completed)
    const totalPomodoros = tasks.value.reduce((sum, t) => sum + t.pomodoroCount, 0)
    const focusMinutes = totalPomodoros * settings.value.focusDuration
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
    setTaskPriority,
    deleteTask,
    toggleComplete,
    incrementPomodoro,
  }
}
