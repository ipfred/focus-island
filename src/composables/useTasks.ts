import { ref, watch, computed } from 'vue'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { emitTo, listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useSettings } from './useSettings'
import { useDailyStats } from './useDailyStats'

// --- Date helpers ---

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// --- Types ---

export interface Subtask {
  id: string
  title: string
  completed: boolean
  pomodoroCount: number
}

export type TaskPriority = 0 | 1 | 2 | 3
export type TimeCategory = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'nodate'

export interface Task {
  id: string
  title: string
  note: string
  groupId: string | null
  dueDate: string | null
  completed: boolean
  pomodoroCount: number
  priority: TaskPriority
  subtasks: Subtask[]
  createdAt: number
  updatedAt: number
  lastActiveAt: number
}

interface TaskBuckets {
  active: Task[]
  completed: Task[]
  recentFocus: Task[]
  overdue: Task[]
  today: Task[]
  tomorrow: Task[]
  week: Task[]
  later: Task[]
  nodate: Task[]
  groups: Map<string, Task[]>
}

export function getTaskTimeCategory(task: Task): TimeCategory {
  if (!task.dueDate) return 'nodate'
  const today = startOfToday()
  const due = parseDateStr(task.dueDate)
  const diff = Math.floor((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff <= 6) return 'week'
  return 'later'
}

// --- State ---

const TASKS_FILE = 'focus-island/tasks.json'

const tasks = ref<Task[]>([])
const loaded = ref(false)
let loadPromise: Promise<void> | null = null

// --- Persistence ---

async function load() {
  try {
    const raw = await readTextFile(TASKS_FILE, { baseDir: BaseDirectory.AppData })
    const parsed = JSON.parse(raw)
    tasks.value = parsed.map((t: Record<string, unknown> & Partial<Task>) => {
      // Migration: convert old category field to dueDate
      if ('category' in t && !('dueDate' in t)) {
        const cat = (t as Record<string, unknown>).category as string | undefined
        const now = new Date()
        if (cat === 'tomorrow') {
          now.setDate(now.getDate() + 1)
        } else if (cat === 'week') {
          now.setDate(now.getDate() + 2)
        }
        // 'today' or anything else → today's date
        t.dueDate = toDateStr(now)
      }

      return {
        note: t.note ?? '',
        groupId: t.groupId ?? null,
        dueDate: t.dueDate ?? toDateStr(new Date()),
        priority: t.completed ? 0 : ((t.priority ?? 0) as TaskPriority),
        subtasks: t.subtasks ?? [],
        ...t,
        lastActiveAt: t.lastActiveAt ?? 0,
      } as Task
    })
  } catch {
    tasks.value = []
  }
  loaded.value = true
}

function ensureLoaded() {
  if (loaded.value || loadPromise) return
  loadPromise = load().finally(() => {
    loadPromise = null
  })
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

// --- Composable ---

export function useTasks() {
  ensureLoaded()
  const { recordTaskCompleted } = useDailyStats()

  function addTask(title: string, dueDate?: string | null, groupId?: string | null, priority?: TaskPriority) {
    const now = Date.now()
    const task: Task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      note: '',
      groupId: groupId ?? null,
      dueDate: dueDate ?? toDateStr(new Date()),
      completed: false,
      pomodoroCount: 0,
      priority: priority ?? 0,
      subtasks: [],
      createdAt: now,
      updatedAt: now,
      lastActiveAt: 0,
    }

    tasks.value.unshift(task)
    return task
  }

  function updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'note' | 'groupId' | 'dueDate' | 'completed' | 'priority'>>) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return

    const wasCompleted = task.completed
    Object.assign(task, patch)

    if (task.completed) {
      task.priority = 0
    }
    if (!wasCompleted && task.completed) {
      recordTaskCompleted()
    }

    task.updatedAt = Date.now()
  }

  function setTaskPriority(id: string, priority: TaskPriority) {
    const task = tasks.value.find(t => t.id === id)
    if (!task || task.completed) return

    task.priority = priority
    task.updatedAt = Date.now()
  }

  function deleteTask(id: string) {
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  function toggleComplete(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return

    const wasCompleted = task.completed
    task.completed = !task.completed
    if (task.completed) {
      task.priority = 0
    } else {
      task.priority = 1 as TaskPriority
    }
    if (!wasCompleted && task.completed) {
      recordTaskCompleted()
    }
    task.updatedAt = Date.now()
  }

  function incrementPomodoro(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (task) {
      task.pomodoroCount++
      task.updatedAt = Date.now()
    }
  }

  function touchTask(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (task) {
      task.lastActiveAt = Date.now()
    }
  }

  // --- Subtask CRUD ---

  function addSubtask(taskId: string, title: string): void {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return
    task.subtasks.push({
      id: crypto.randomUUID(),
      title: title.trim(),
      completed: false,
      pomodoroCount: 0,
    })
    task.updatedAt = Date.now()
  }

  function toggleSubtask(taskId: string, subtaskId: string): void {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return
    const subtask = task.subtasks.find(s => s.id === subtaskId)
    if (!subtask) return
    subtask.completed = !subtask.completed
    task.updatedAt = Date.now()
  }

  function deleteSubtask(taskId: string, subtaskId: string): void {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return
    task.subtasks = task.subtasks.filter(s => s.id !== subtaskId)
    task.updatedAt = Date.now()
  }

  function incrementSubtaskPomodoro(taskId: string, subtaskId: string): void {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) return
    const subtask = task.subtasks.find(s => s.id === subtaskId)
    if (!subtask) return
    subtask.pomodoroCount++
    task.updatedAt = Date.now()
  }

  // --- Computed views ---

  const taskBuckets = computed<TaskBuckets>(() => {
    const buckets: TaskBuckets = {
      active: [],
      completed: [],
      recentFocus: [],
      overdue: [],
      today: [],
      tomorrow: [],
      week: [],
      later: [],
      nodate: [],
      groups: new Map(),
    }

    for (const task of tasks.value) {
      if (task.completed) {
        buckets.completed.push(task)
        continue
      }

      buckets.active.push(task)

      if (task.lastActiveAt > 0) {
        buckets.recentFocus.push(task)
      }

      if (task.groupId) {
        const groupTasks = buckets.groups.get(task.groupId)
        if (groupTasks) {
          groupTasks.push(task)
        } else {
          buckets.groups.set(task.groupId, [task])
        }
      }

      const category = getTaskTimeCategory(task)
      if (category === 'overdue') {
        buckets.overdue.push(task)
        buckets.today.push(task)
      } else if (category === 'today') {
        buckets.today.push(task)
      } else if (category === 'tomorrow') {
        buckets.tomorrow.push(task)
      } else if (category === 'week') {
        buckets.week.push(task)
      } else if (category === 'later') {
        buckets.later.push(task)
      } else {
        buckets.nodate.push(task)
      }
    }

    buckets.recentFocus.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    buckets.recentFocus = buckets.recentFocus.slice(0, 3)
    return buckets
  })

  const activeTasks = computed(() => taskBuckets.value.active)
  const completedTasks = computed(() => taskBuckets.value.completed)
  const recentFocusTasks = computed(() => taskBuckets.value.recentFocus)

  const overdueTasks = computed(() => taskBuckets.value.overdue)
  const todayTasks = computed(() => taskBuckets.value.today)
  const tomorrowTasks = computed(() => taskBuckets.value.tomorrow)
  const weekTasks = computed(() => taskBuckets.value.week)
  const laterTasks = computed(() => taskBuckets.value.later)
  const nodateTasks = computed(() => taskBuckets.value.nodate)

  function groupTasks(groupId: string): Task[] {
    return taskBuckets.value.groups.get(groupId) ?? []
  }

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
    completedTasks,
    recentFocusTasks,
    overdueTasks,
    todayTasks,
    tomorrowTasks,
    weekTasks,
    laterTasks,
    nodateTasks,
    todayStats,
    addTask,
    updateTask,
    setTaskPriority,
    deleteTask,
    toggleComplete,
    incrementPomodoro,
    touchTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    incrementSubtaskPomodoro,
    groupTasks,
  }
}
