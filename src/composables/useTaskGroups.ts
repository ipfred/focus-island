import { ref, watch } from 'vue'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { emitTo, listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { type CategoryColorId } from './useMemos'

export interface TaskGroup {
  id: string
  name: string
  color: CategoryColorId
  order: number
}

const GROUPS_FILE = 'focus-island/task-groups.json'

const groups = ref<TaskGroup[]>([])
const loaded = ref(false)
let loadPromise: Promise<void> | null = null

// --- Persistence ---

async function load() {
  try {
    const raw = await readTextFile(GROUPS_FILE, { baseDir: BaseDirectory.AppData })
    groups.value = JSON.parse(raw)
  } catch {
    groups.value = []
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
    const json = JSON.stringify(groups.value)
    await writeTextFile(GROUPS_FILE, json, { baseDir: BaseDirectory.AppData })
    // Broadcast to other windows
    const self = getCurrentWebviewWindow().label
    const targets = self === 'main' ? ['panel'] : ['main']
    for (const target of targets) {
      emitTo(target, 'task-groups-updated', json).catch(() => {})
    }
  } catch (e) {
    console.error('Failed to save task groups', e)
  }
}

watch(groups, save, { deep: true })

// Listen for cross-window task group updates
listen<string>('task-groups-updated', (event) => {
  try {
    isSyncing = true
    groups.value = JSON.parse(event.payload)
    setTimeout(() => { isSyncing = false }, 50)
  } catch { /* ignore */ }
})

// --- Composable ---

export function useTaskGroups() {
  ensureLoaded()

  function addGroup(name: string, colorId: CategoryColorId = 'blue'): TaskGroup {
    const maxOrder = groups.value.length > 0
      ? Math.max(...groups.value.map(g => g.order))
      : -1
    const group: TaskGroup = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color: colorId,
      order: maxOrder + 1,
    }
    groups.value.push(group)
    return group
  }

  function deleteGroup(id: string) {
    groups.value = groups.value.filter(g => g.id !== id)
  }

  function renameGroup(id: string, name: string) {
    const group = groups.value.find(g => g.id === id)
    if (!group) return
    group.name = name.trim()
  }

  function recolorGroup(id: string, color: CategoryColorId) {
    const group = groups.value.find(g => g.id === id)
    if (!group) return
    group.color = color
  }

  return {
    groups,
    addGroup,
    deleteGroup,
    renameGroup,
    recolorGroup,
  }
}
