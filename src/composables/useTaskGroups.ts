import { ref } from 'vue'
import { createPersistedStore } from './persistence'
import { type CategoryColorId } from './useMemos'

export interface TaskGroup {
  id: string
  name: string
  color: CategoryColorId
  order: number
}

const groups = ref<TaskGroup[]>([])

const store = createPersistedStore({
  file: 'task-groups.json',
  snapshot: () => groups.value,
  restore: (data) => {
    if (!Array.isArray(data)) throw new Error('task-groups.json is not an array')
    groups.value = data as TaskGroup[]
  },
  syncEvent: 'task-groups-updated',
})

// --- Composable ---

export function useTaskGroups() {
  void store.ensureLoaded()

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
