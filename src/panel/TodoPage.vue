<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useTasks, getTaskTimeCategory, type Task } from '../composables/useTasks'
import { useTaskGroups } from '../composables/useTaskGroups'
import { useTimerBridge } from '../composables/useTimerBridge'
import { getCategoryColor } from '../composables/useMemos'
import TaskGroupDialog from './TaskGroupDialog.vue'
import CalendarDatePicker from './CalendarDatePicker.vue'

const props = defineProps<{ initialTab?: string; searchQuery?: string }>()
const emit = defineEmits<{
  viewDetail: [taskId: string],
  tabChange: [tab: string],
  activeTabLabel: [label: string]
}>()

const {
  tasks,
  addTask,
  toggleComplete,
  deleteTask,
  updateTask,
  incrementPomodoro,
  touchTask,
  toggleSubtask,
  todayTasks,
  tomorrowTasks,
  weekTasks,
  laterTasks,
  completedTasks,
  groupTasks,
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

// --- Tab state ---
type TabKey = string
const activeTab = ref<TabKey>(props.initialTab ?? 'today')

// Watch for external tab changes (e.g. navigation from home page)
watch(() => props.initialTab, (tab) => {
  if (tab) {
    activeTab.value = tab
    nextTick(() => {
      setTimeout(() => {
        const el = tabScrollRef.value?.querySelector(`.tab-item.active`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        }
      }, 50)
    })
  }
})

// --- Category Tabs Dropdown & Overflow check ---
const tabScrollRef = ref<HTMLElement | null>(null)
const hasOverflow = ref(false)
const showTabsDropdown = ref(false)

const checkOverflow = () => {
  if (tabScrollRef.value) {
    const el = tabScrollRef.value
    hasOverflow.value = el.scrollWidth > el.clientWidth
  }
}

const selectTab = (key: string) => {
  activeTab.value = key
  showTabsDropdown.value = false
  nextTick(() => {
    const el = tabScrollRef.value?.querySelector(`.tab-item.active`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  })
}

let targetScrollLeft = 0
let currentScrollLeft = 0
let isScrolling = false

const handleWheel = (e: WheelEvent) => {
  if (!tabScrollRef.value) return
  
  const el = tabScrollRef.value
  
  // Sync target and high-precision current scrollLeft with the actual scroll position if not animating
  if (!isScrolling) {
    targetScrollLeft = el.scrollLeft
    currentScrollLeft = el.scrollLeft
  }
  
  // Decrease delta step multiplier to 0.35 (from 0.5) to make it tighter and more precise
  const multiplier = 0.35
  const maxScroll = el.scrollWidth - el.clientWidth
  
  // Accumulate the target scroll
  targetScrollLeft = Math.max(0, Math.min(maxScroll, targetScrollLeft + e.deltaY * multiplier))
  
  if (!isScrolling) {
    isScrolling = true
    const animate = () => {
      if (!tabScrollRef.value) {
        isScrolling = false
        return
      }
      
      const container = tabScrollRef.value
      
      // If external scroll happens (e.g. click to center), sync currentScrollLeft
      if (Math.abs(container.scrollLeft - Math.round(currentScrollLeft)) > 1) {
        currentScrollLeft = container.scrollLeft
      }
      
      const diff = targetScrollLeft - currentScrollLeft
      
      // Increase damping factor to 0.28 (from 0.15) to make it catch up faster, eliminating lag/choppiness
      if (Math.abs(diff) > 0.5) {
        currentScrollLeft += diff * 0.28
        container.scrollLeft = Math.round(currentScrollLeft)
        requestAnimationFrame(animate)
      } else {
        currentScrollLeft = targetScrollLeft
        container.scrollLeft = Math.round(targetScrollLeft)
        isScrolling = false
      }
    }
    requestAnimationFrame(animate)
  }
}


const showGroupDialog = ref(false)

// --- Quick-add state ---
const newTitle = ref('')
const selectedGroupId = ref<string | null>(null)
const selectedDate = ref<string | null>(formatDateStr(new Date()))
const showDatePicker = ref(false)
const showGroupDropdown = ref(false)
const quickAddRef = ref<HTMLInputElement | null>(null)

// --- Completed section ---
const showCompleted = ref(false)

// --- Batch operations (completed tab) ---
const selectedIds = ref<Set<string>>(new Set())
const selectionMode = ref(false)

const allCompletedIds = computed(() => displayTasks.value.map(t => t.id))
const allSelected = computed(() => allCompletedIds.value.length > 0 && allCompletedIds.value.every(id => selectedIds.value.has(id)))
const someSelected = computed(() => selectedIds.value.size > 0)
const olderThan7dCount = computed(() => {
  const cutoff = Date.now() - 7 * 86400000
  return completedTasks.value.filter(t => t.updatedAt < cutoff).length
})

function toggleOneSelected(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
  if (next.size === 0) selectionMode.value = false
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
    selectionMode.value = false
  } else {
    selectedIds.value = new Set(allCompletedIds.value)
    selectionMode.value = true
  }
}

function deleteSelected() {
  if (selectedIds.value.size === 0) return
  const ids = [...selectedIds.value]
  for (const id of ids) deleteTask(id)
  selectedIds.value = new Set()
  selectionMode.value = false
}

function restoreSelected() {
  if (selectedIds.value.size === 0) return
  const ids = [...selectedIds.value]
  for (const id of ids) toggleComplete(id)
  selectedIds.value = new Set()
  selectionMode.value = false
}

function deleteOlderThan7d() {
  const cutoff = Date.now() - 7 * 86400000
  const ids = completedTasks.value.filter(t => t.updatedAt < cutoff).map(t => t.id)
  if (ids.length === 0) return
  for (const id of ids) deleteTask(id)
  selectedIds.value = new Set()
  selectionMode.value = false
}

function deleteAllCompleted() {
  const ids = completedTasks.value.map(t => t.id)
  if (ids.length === 0) return
  for (const id of ids) deleteTask(id)
  selectedIds.value = new Set()
  selectionMode.value = false
}

// Clear selection when leaving the completed tab
watch(activeTab, (tab) => {
  if (tab !== 'completed') {
    selectedIds.value = new Set()
    selectionMode.value = false
  }
})

// --- Subtask expand state ---
const expandedSubtasks = ref<Set<string>>(new Set())

function toggleSubtaskExpand(taskId: string) {
  if (expandedSubtasks.value.has(taskId)) {
    expandedSubtasks.value.delete(taskId)
  } else {
    expandedSubtasks.value.add(taskId)
  }
}

// --- Show more pagination ---
const PAGE_SIZE = 10
const visibleCount = ref(PAGE_SIZE)

const displayVisibleTasks = computed<Task[]>(() => {
  const all = displayTasks.value
  return all.slice(0, visibleCount.value)
})

const hasMoreTasks = computed(() => displayTasks.value.length > visibleCount.value)

function loadMore() {
  visibleCount.value += PAGE_SIZE
}

// reset pagination on tab change & sync tab selection back to parent & update default group for new tasks
watch(activeTab, (newTab) => {
  visibleCount.value = PAGE_SIZE
  emit('tabChange', newTab)
  
  // Set default group for new tasks if the selected tab is a custom group
  const systemTabs = ['today', 'tomorrow', 'week', 'later', 'completed']
  if (systemTabs.includes(newTab)) {
    selectedGroupId.value = null
  } else {
    selectedGroupId.value = newTab
  }
}, { immediate: true })

// Reset pagination when search query changes
watch(() => props.searchQuery, () => {
  visibleCount.value = PAGE_SIZE
})

// --- Context menu ---
const contextMenu = ref<{ taskId: string; x: number; y: number } | null>(null)

// --- Helpers ---
function formatDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const diff = Math.floor((date.getTime() - today.getTime()) / (86400000))
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === -1) return '昨天'
  return `${m}/${d}`
}

function handleAddTask() {
  const t = newTitle.value.trim()
  if (!t) return
  addTask(t, selectedDate.value, selectedGroupId.value)
  newTitle.value = ''
  quickAddRef.value?.focus()
}

function handleStartTask(task: Task) {
  setSubtaskContext(null, null)
  if (activeTaskId.value === task.id) {
    if (running.value) pause()
    else resume()
  } else {
    touchTask(task.id)
    start(task.id, task.title)
  }
}

function handleStartSubtask(task: Task, subtaskId: string) {
  const sub = task.subtasks.find(s => s.id === subtaskId)
  if (sub) {
    touchTask(task.id)
    setSubtaskContext(sub.id, sub.title)
    start(task.id, `${task.title} — ${sub.title}`)
  }
}

function handleToggleComplete(taskId: string) {
  if (activeTaskId.value === taskId) {
    abandon()
  }
  toggleComplete(taskId)
}

function handleDoneTimer() {
  if (!activeTaskId.value) return
  incrementPomodoro(activeTaskId.value)
  abandon()
}

// --- Search ---
function taskMatchesQuery(task: Task, query: string): boolean {
  if (!query) return true
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (task.title.toLowerCase().includes(q)) return true
  if (task.note && task.note.toLowerCase().includes(q)) return true
  if (task.subtasks && task.subtasks.some(s => s.title.toLowerCase().includes(q))) return true
  return false
}

// --- Tabs ---
const allTabs = computed<{ key: string; label: string; count: number }[]>(() => {
  const tabs: { key: string; label: string; count: number }[] = [
    { key: 'today', label: '今天', count: todayTasks.value.length },
    { key: 'tomorrow', label: '明天', count: tomorrowTasks.value.length },
    { key: 'week', label: '本周', count: weekTasks.value.length },
    { key: 'later', label: '稍后', count: laterTasks.value.length },
    { key: 'completed', label: '已完成', count: completedTasks.value.length },
  ]
  for (const group of groups.value) {
    const groupTaskList = groupTasks(group.id)
    tabs.push({ key: group.id, label: group.name, count: groupTaskList.length })
  }
  return tabs
})

const activeTabLabel = computed(() => {
  const tab = allTabs.value.find(t => t.key === activeTab.value)
  return tab?.label ?? ''
})

watch(activeTabLabel, (label) => {
  emit('activeTabLabel', label)
}, { immediate: true })

// --- Display tasks ---
const displayTasks = computed<Task[]>(() => {
  const tab = activeTab.value
  const q = props.searchQuery ?? ''
  let list: Task[]
  if (tab === 'today') {
    list = [...todayTasks.value].sort((a, b) => {
      const catA = getTaskTimeCategory(a)
      const catB = getTaskTimeCategory(b)
      if (catA === catB) return 0
      if (catA === 'today') return -1
      return 1
    })
  } else if (tab === 'tomorrow') {
    list = tomorrowTasks.value
  } else if (tab === 'week') {
    list = weekTasks.value
  } else if (tab === 'later') {
    list = laterTasks.value
  } else if (tab === 'completed') {
    list = completedTasks.value
  } else {
    list = groupTasks(tab)
  }
  if (!q.trim()) return list
  return list.filter(t => taskMatchesQuery(t, q))
})

const displayCompleted = computed<Task[]>(() => {
  const tab = activeTab.value
  const q = (props.searchQuery ?? '').trim()
  if (tab === 'completed' || tab === 'today') return []
  let currentCompleted: Task[]
  if (tab === 'tomorrow') {
    currentCompleted = tasks.value.filter(t => t.completed && getTaskTimeCategory(t) === 'tomorrow')
  } else if (tab === 'week') {
    currentCompleted = tasks.value.filter(t => t.completed && getTaskTimeCategory(t) === 'week')
  } else if (tab === 'later') {
    currentCompleted = tasks.value.filter(t => t.completed && getTaskTimeCategory(t) === 'later')
  } else {
    currentCompleted = tasks.value.filter(t => t.completed && t.groupId === tab)
  }
  if (!q) return currentCompleted
  return currentCompleted.filter(t => taskMatchesQuery(t, q))
})

// --- Context menu ---
function onContextMenu(e: MouseEvent, task: Task) {
  e.preventDefault()
  if (contextMenu.value && contextMenu.value.taskId === task.id) {
    closeContextMenu()
  } else {
    contextMenu.value = { taskId: task.id, x: e.clientX, y: e.clientY }
    nextTick(() => {
      const menuEl = document.querySelector('.context-menu') as HTMLElement | null
      if (menuEl && contextMenu.value) {
        const menuWidth = menuEl.offsetWidth
        const menuHeight = menuEl.offsetHeight
        
        let adjustedX = e.clientX
        let adjustedY = e.clientY
        
        // If it overflows the right edge of the window
        if (e.clientX + menuWidth > window.innerWidth) {
          adjustedX = Math.max(0, e.clientX - menuWidth)
        }
        
        // If it overflows the bottom edge of the window
        if (e.clientY + menuHeight > window.innerHeight) {
          adjustedY = Math.max(0, e.clientY - menuHeight)
        }
        
        contextMenu.value = {
          taskId: task.id,
          x: adjustedX,
          y: adjustedY
        }
      }
    })
  }
}

function closeContextMenu() {
  contextMenu.value = null
}

function contextSetDate(dateStr: string) {
  if (!contextMenu.value) return
  updateTask(contextMenu.value.taskId, { dueDate: dateStr })
  closeContextMenu()
}

function contextDelete() {
  if (!contextMenu.value) return
  deleteTask(contextMenu.value.taskId)
  closeContextMenu()
}

function contextMoveToGroup(groupId: string | null) {
  if (!contextMenu.value) return
  updateTask(contextMenu.value.taskId, { groupId })
  closeContextMenu()
}

const isMenuOnRight = computed(() => {
  if (!contextMenu.value) return false
  return contextMenu.value.x > 200
})

// --- Date picker helpers ---
function setQuickDate(offset: number) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  selectedDate.value = formatDateStr(d)
  showDatePicker.value = false
}

// --- Click outside ---
function onClickOutside() {
  closeContextMenu()
  showDatePicker.value = false
  showGroupDropdown.value = false
  showTabsDropdown.value = false
}

function onWindowClick(e: MouseEvent) {
  if (contextMenu.value) {
    const target = e.target as HTMLElement
    if (!target.closest('.context-menu')) {
      closeContextMenu()
    }
  }
}

function onWindowContextMenu(e: MouseEvent) {
  if (contextMenu.value) {
    const target = e.target as HTMLElement
    if (!target.closest('.context-menu') && !target.closest('.task-card')) {
      closeContextMenu()
    }
  }
}

// Group dropdown label
const selectedGroupLabel = computed(() => {
  if (!selectedGroupId.value) return '无分组'
  const g = groups.value.find(g => g.id === selectedGroupId.value)
  return g?.name ?? '无分组'
})

// Keyboard handler for Escape
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (selectionMode.value) {
      selectionMode.value = false
      selectedIds.value = new Set()
    } else if (showGroupDialog.value) {
      showGroupDialog.value = false
    } else if (contextMenu.value) {
      closeContextMenu()
    }
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('click', onClickOutside)
  window.addEventListener('click', onWindowClick, true)
  window.addEventListener('contextmenu', onWindowContextMenu, true)

  if (tabScrollRef.value) {
    checkOverflow()
    resizeObserver = new ResizeObserver(() => {
      checkOverflow()
    })
    resizeObserver.observe(tabScrollRef.value)
  }
  // Watch allTabs changes to recalculate overflow
  watch(() => allTabs.value, () => {
    nextTick(() => {
      checkOverflow()
    })
  }, { deep: true })

  // Instantly scroll active tab into view on mount (so returning from detail page centers the tab)
  nextTick(() => {
    setTimeout(() => {
      const el = tabScrollRef.value?.querySelector(`.tab-item.active`)
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
      }
    }, 50)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('click', onClickOutside)
  window.removeEventListener('click', onWindowClick, true)
  window.removeEventListener('contextmenu', onWindowContextMenu, true)

  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})
</script>

<template>
  <div class="todo-page" @click="onClickOutside">
    <!-- Tab bar as header -->
    <header class="todo-header" @click.stop>
      <div class="tab-scroll" ref="tabScrollRef" @wheel.prevent="handleWheel">
        <button
          v-for="tab in allTabs"
          :key="tab.key"
          class="tab-item"
          :class="{ active: activeTab === tab.key }"
          @click="selectTab(tab.key)"
        >
          <span
            v-if="tab.key !== 'today' && tab.key !== 'tomorrow' && tab.key !== 'week' && tab.key !== 'later' && tab.key !== 'completed' && groups.find(g => g.id === tab.key)"
            class="tab-group-dot"
            :style="{ backgroundColor: getCategoryColor(groups.find(g => g.id === tab.key)!.color).icon }"
          ></span>
          <span class="tab-label">{{ tab.label }}</span>
          <span v-if="tab.count > 0" class="tab-count">{{ tab.count }}</span>
        </button>
      </div>

      <!-- Category dropdown when overflowing -->
      <div v-if="hasOverflow" class="tabs-dropdown-container">
        <button
          class="header-btn dropdown-trigger"
          :class="{ active: showTabsDropdown }"
          @click.stop="showTabsDropdown = !showTabsDropdown"
          title="选择分类"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div v-if="showTabsDropdown" class="tabs-dropdown-menu">
          <button
            v-for="tab in allTabs"
            :key="'drop-' + tab.key"
            class="tabs-dropdown-item"
            :class="{ active: activeTab === tab.key }"
            @click="selectTab(tab.key)"
          >
            <div class="tabs-drop-left">
              <span
                v-if="tab.key !== 'today' && tab.key !== 'tomorrow' && tab.key !== 'week' && tab.key !== 'later' && tab.key !== 'completed' && groups.find(g => g.id === tab.key)"
                class="tab-group-dot"
                :style="{ backgroundColor: getCategoryColor(groups.find(g => g.id === tab.key)!.color).icon }"
              ></span>
              <span class="tabs-drop-label">{{ tab.label }}</span>
            </div>
            <span v-if="tab.count > 0" class="tabs-drop-count">{{ tab.count }}</span>
          </button>
        </div>
      </div>

      <button class="header-btn gear-btn" @click.stop="showGroupDialog = !showGroupDialog" title="管理分组">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1 1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.39 1.26 1 1.51.16.07.33.1.51.1H21a2 2 0 0 1 0 4h-.09c-.66 0-1.26.39-1.51 1Z"/>
        </svg>
      </button>
    </header>

    <!-- Quick-add row (hidden on completed tab) -->
    <div v-if="activeTab !== 'completed'" class="quick-add" @click.stop>
      <div class="quick-add-input-row">
        <button class="inline-chip group-chip" :class="{ active: showGroupDropdown }" @click.stop="showGroupDropdown = !showGroupDropdown; showDatePicker = false" :title="'分组: ' + selectedGroupLabel">
          <span v-if="selectedGroupId" class="group-dot" :style="{ backgroundColor: getCategoryColor(groups.find(g => g.id === selectedGroupId)?.color ?? 'yellow').icon }"></span>
          <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span class="chip-label">{{ selectedGroupLabel }}</span>
        </button>
        <input
          ref="quickAddRef"
          v-model="newTitle"
          class="quick-add-input"
          placeholder="添加任务..."
          @keydown.enter="handleAddTask"
          @click.stop
          @focus="showGroupDropdown = false; showDatePicker = false"
        />
        <button class="inline-chip date-chip" :class="{ active: showDatePicker }" @click.stop="showDatePicker = !showDatePicker; showGroupDropdown = false" :title="'到期: ' + (formatShortDate(selectedDate) || '无日期')">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span class="chip-label">{{ formatShortDate(selectedDate) || '无日期' }}</span>
        </button>
      </div>
      <!-- Group dropdown popup -->
      <div v-if="showGroupDropdown" class="chip-dropdown group-dropdown-menu" @click.stop>
        <button class="group-dropdown-item" :class="{ active: !selectedGroupId }" @click="selectedGroupId = null; showGroupDropdown = false">
          无分组
        </button>
        <button
          v-for="group in groups"
          :key="group.id"
          class="group-dropdown-item"
          :class="{ active: selectedGroupId === group.id }"
          @click="selectedGroupId = group.id; showGroupDropdown = false"
        >
          <span class="group-dot" :style="{ backgroundColor: getCategoryColor(group.color).icon }"></span>
          {{ group.name }}
        </button>
      </div>
      <!-- Date picker popup -->
      <div v-if="showDatePicker" class="chip-dropdown date-picker-menu" @click.stop>
        <CalendarDatePicker
          v-model="selectedDate"
          :clearable="true"
          @close="showDatePicker = false"
        />
      </div>
    </div>

    <!-- Completed tab: batch toolbar -->
    <div v-if="activeTab === 'completed' && displayTasks.length > 0" class="batch-toolbar" @click.stop>
      <div class="batch-left">
        <button
          class="batch-select-all"
          :class="{ checked: allSelected, partial: someSelected && !allSelected }"
          @click="toggleSelectAll"
          :title="allSelected ? '取消全选' : '全选'"
        >
          <svg v-if="allSelected" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
          <span v-else-if="someSelected" class="partial-bar"></span>
        </button>
        <span class="batch-hint" @click="selectionMode = !selectionMode">
          {{ someSelected ? `已选 ${selectedIds.size}` : (selectionMode ? '点击任务进行选择' : '批量管理') }}
        </span>
      </div>
      <div class="batch-right">
        <button v-if="someSelected" class="batch-btn restore" @click="restoreSelected" title="恢复所选任务">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          <span>恢复</span>
        </button>
        <button v-if="someSelected" class="batch-btn danger" @click="deleteSelected" title="删除所选">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
          <span>删除所选</span>
        </button>
        <button v-if="olderThan7dCount > 0" class="batch-btn subtle" @click="deleteOlderThan7d" title="删除 7 天前的已完成任务">
          清理7天前
        </button>
        <button v-if="displayTasks.length > 0" class="batch-btn subtle danger" @click="deleteAllCompleted" title="删除全部已完成任务">
          全部删除
        </button>
      </div>
    </div>

    <!-- Task list -->
    <div class="task-list">
      <div v-if="displayTasks.length === 0 && displayCompleted.length === 0" class="empty-state">
        <svg v-if="searchQuery" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <svg v-else width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <span>{{ searchQuery ? '没有匹配的任务' : '暂无任务' }}</span>
      </div>

      <template v-for="(task, index) in displayVisibleTasks" :key="task.id">
        <div
          v-if="activeTab === 'today' && getTaskTimeCategory(task) === 'overdue' && (index === 0 || getTaskTimeCategory(displayVisibleTasks[index-1]) === 'today')"
          class="overdue-divider"
        >
          <span class="divider-label">已过期</span>
        </div>
        <div
          class="task-card"
          :class="{
            'is-running': activeTaskId === task.id,
            'is-completed': task.completed,
            'is-selected': activeTab === 'completed' && selectedIds.has(task.id),
          }"
          @contextmenu="onContextMenu($event, task)"
          @click="activeTab === 'completed' && selectionMode ? toggleOneSelected(task.id) : null"
        >
          <!-- Row 1: checkbox + title + actions -->
          <div class="task-row">
            <button
              v-if="activeTab === 'completed'"
              class="task-checkbox batch-checkbox"
              :class="{ checked: selectedIds.has(task.id) }"
              @click.stop="toggleOneSelected(task.id)"
              :title="selectedIds.has(task.id) ? '取消选择' : '选择'"
            >
              <svg v-if="selectedIds.has(task.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
            </button>
            <button
              class="task-checkbox"
              :class="{ checked: task.completed }"
              @click="handleToggleComplete(task.id)"
            >
              <svg v-if="task.completed" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
            </button>

            <span class="task-title" :class="{ 'line-through': task.completed }" @click="emit('viewDetail', task.id)">{{ task.title }}</span>

            <!-- Timer display (if running on this task) -->
            <div v-if="activeTaskId === task.id" class="task-timer" @click.stop>
              <span class="timer-phase">{{ phase === 'focus' ? '专注' : '休息' }}</span>
              <span class="timer-time">{{ displayTime }}</span>
              <div class="timer-controls">
                <button class="timer-btn" :class="{ 'is-paused': !running }" @click.stop="running ? pause() : resume()" :title="running ? '暂停' : '继续'">
                  <svg v-if="running" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                  <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>
                </button>
                <button class="timer-btn done-btn" @click.stop="handleDoneTimer" title="完成">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                </button>
                <button class="timer-btn stop-btn" @click.stop="abandon()" title="停止">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
                </button>
              </div>
            </div>

            <!-- Play button (if not running on this task) -->
            <button
              v-else
              class="task-play-btn"
              @click.stop="handleStartTask(task)"
              title="开始专注"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>
            </button>

            <!-- Subtask toggle button (next to play button) -->
            <button
              v-if="task.subtasks.length > 0"
              class="subtask-toggle-btn"
              :class="{ expanded: expandedSubtasks.has(task.id) }"
              @click.stop="toggleSubtaskExpand(task.id)"
              :title="expandedSubtasks.has(task.id) ? '收起子任务' : '展开子任务'"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>

          <!-- Row 2: meta badges -->
          <div v-if="task.dueDate || task.pomodoroCount > 0 || task.groupId" class="task-meta-row">
            <span v-if="task.pomodoroCount > 0" class="task-pomodoro">🍅 {{ task.pomodoroCount }}</span>
            <span v-if="task.dueDate" class="task-date">
              {{ formatShortDate(task.dueDate) }}
            </span>
            <span v-if="task.groupId" class="task-group-badge">
              <span class="group-dot-sm" :style="{ backgroundColor: getCategoryColor(groups.find(g => g.id === task.groupId)?.color ?? 'yellow').icon }"></span>
              {{ groups.find(g => g.id === task.groupId)?.name ?? '' }}
            </span>
          </div>

          <!-- Subtasks (expanded) -->
          <div v-if="task.subtasks.length > 0 && expandedSubtasks.has(task.id)" class="subtask-list">
            <div
              v-for="sub in task.subtasks"
              :key="sub.id"
              class="subtask-row"
              :class="{ 'is-active-sub': activeSubtaskId === sub.id, completed: sub.completed }"
            >
              <button
                class="subtask-checkbox"
                :class="{ checked: sub.completed }"
                @click.stop="toggleSubtask(task.id, sub.id)"
              >
                <svg v-if="sub.completed" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
              </button>
              <span class="subtask-title" :class="{ 'line-through': sub.completed }">{{ sub.title }}</span>
              <button
                class="subtask-play-btn"
                :class="{ active: activeSubtaskId === sub.id }"
                @click.stop="handleStartSubtask(task, sub.id)"
                title="开始子任务"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- Load more -->
      <button v-if="hasMoreTasks" class="load-more-btn" @click="loadMore">
        加载更多 ({{ displayTasks.length - visibleCount }} 条)
      </button>

      <!-- Completed section -->
      <div v-if="displayCompleted.length > 0" class="completed-section">
        <button class="completed-header" @click.stop="showCompleted = !showCompleted">
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            :style="{ transform: showCompleted ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }"
          >
            <path d="M9 18l6-6-6-6"/>
          </svg>
          <span>已完成 ({{ displayCompleted.length }})</span>
        </button>
        <transition name="collapse">
          <div v-if="showCompleted" class="completed-list">
            <div
              v-for="task in displayCompleted"
              :key="task.id"
              class="task-card completed-card"
              @click="emit('viewDetail', task.id)"
            >
              <div class="task-row">
                <button class="task-checkbox checked" @click.stop="toggleComplete(task.id)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                </button>
                <span class="task-title line-through">{{ task.title }}</span>
                <span v-if="task.pomodoroCount > 0" class="task-pomodoro completed-pomodoro">🍅 {{ task.pomodoroCount }}</span>
              </div>
              <div v-if="task.dueDate || task.groupId" class="task-meta-row">
                <span v-if="task.dueDate" class="task-date">{{ formatShortDate(task.dueDate) }}</span>
                <span v-if="task.groupId" class="task-group-badge">
                  <span class="group-dot-sm" :style="{ backgroundColor: getCategoryColor(groups.find(g => g.id === task.groupId)?.color ?? 'yellow').icon }"></span>
                  {{ groups.find(g => g.id === task.groupId)?.name ?? '' }}
                </span>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <!-- Context menu -->
    <teleport to=".panel-inner">
      <div
        v-if="contextMenu"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @click.stop
      >
        <button class="context-menu-item" @click="contextSetDate(formatDateStr(new Date()))">今天到期</button>
        <button class="context-menu-item" @click="contextSetDate(formatDateStr(new Date(new Date().setDate(new Date().getDate() + 1))))">明天到期</button>
        
        <div class="context-menu-item-with-submenu">
          <button class="context-menu-item submenu-trigger">
            <span>移动至分组</span>
            <span class="submenu-arrow">›</span>
          </button>
          <div class="context-sub-menu" :class="{ 'pos-left': isMenuOnRight }">
            <button class="context-menu-item flex-item" @click="contextMoveToGroup(null)">
              <span class="group-dot-sm" style="background-color: rgba(255, 255, 255, 0.2)"></span>
              <span class="context-menu-text">无分组</span>
            </button>
            <div v-if="groups.length > 0" class="context-menu-divider"></div>
            <button
              v-for="group in groups"
              :key="group.id"
              class="context-menu-item flex-item"
              @click="contextMoveToGroup(group.id)"
            >
              <span class="group-dot-sm" :style="{ backgroundColor: getCategoryColor(group.color).icon }"></span>
              <span class="context-menu-text">{{ group.name }}</span>
            </button>
          </div>
        </div>

        <div class="context-menu-divider"></div>
        <button class="context-menu-item danger" @click="contextDelete">删除</button>
      </div>
    </teleport>

    <!-- TaskGroupDialog overlay -->
    <TaskGroupDialog v-if="showGroupDialog" @close="showGroupDialog = false" />
  </div>
</template>

<style scoped>
@reference "../styles.css";

.todo-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Header with integrated tabs */
.todo-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.header-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
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

/* Quick-add row */
.quick-add {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  flex-shrink: 0;
}

.quick-add-input-row {
  display: flex;
  align-items: center;
  gap: 0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s;
}

.quick-add-input-row:focus-within {
  border-color: color-mix(in srgb, var(--focus-color) 50%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus-color) 12%, transparent);
}

.inline-chip {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 5px 8px;
  background: none;
  border: none;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.inline-chip:hover,
.inline-chip.active {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.05);
}

.chip-label {
  max-width: 48px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-chip .group-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.date-chip {
  border-right: none;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.quick-add-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  padding: 7px 10px;
  font-size: 13px;
  color: #fff;
  outline: none;
  font-family: inherit;
}

.quick-add-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.chip-dropdown {
  position: absolute;
  top: calc(100% - 10px);
  z-index: 50;
  min-width: 140px;
  padding: 4px;
  border-radius: 10px;
  background: rgba(28, 28, 32, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  margin-top: 4px;
}

.group-dropdown-menu {
  left: 12px;
}

.date-picker-menu {
  right: 12px;
  min-width: 120px;
}

.group-dropdown-item {
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

.group-dropdown-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.group-dropdown-item.active {
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  color: var(--focus-color);
}

.group-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.group-dot-sm {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Tabs in header */
.tab-scroll {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tab-scroll::-webkit-scrollbar {
  display: none;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  white-space: nowrap;
  flex-shrink: 0;
}

.tab-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.8);
}

.tab-item.active {
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 30%, transparent);
  color: var(--focus-color);
}

.tab-label {
  line-height: 1;
}

.tab-count {
  font-size: 10px;
}

.overdue-divider {
  display: flex;
  align-items: center;
  padding: 10px 14px 6px;
  gap: 12px;
}

.overdue-divider::before,
.overdue-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(
    to var(--dir, right),
    color-mix(in srgb, var(--focus-color) 35%, transparent),
    transparent
  );
}

.overdue-divider::before {
  --dir: left;
}

.overdue-divider::after {
  --dir: right;
}

.divider-label {
  font-size: 10px;
  font-weight: 800;
  color: color-mix(in srgb, var(--focus-color) 60%, transparent);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  white-space: nowrap;
  font-family: inherit;
}

.tab-group-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Task list */
.task-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-list::-webkit-scrollbar {
  width: 4px;
}

.task-list::-webkit-scrollbar-track {
  background: transparent;
}

.task-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
  flex-shrink: 0;
}

/* Task card */
.task-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.2s;
  overflow: hidden;
  flex-shrink: 0;
}

.task-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}

.task-card.is-running {
  background: color-mix(in srgb, var(--focus-color) 10%, rgba(28, 28, 32, 0.95));
  border-color: color-mix(in srgb, var(--focus-color) 30%, transparent);
  border-left: 3px solid var(--focus-color);
  padding: 8px 10px;
}

.task-card.completed-card {
  opacity: 0.55;
}

.task-card.completed-card:hover {
  opacity: 0.75;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.task-checkbox {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.28);
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
  border-color: var(--break-color);
  background: color-mix(in srgb, var(--break-color) 20%, transparent);
}

.task-checkbox.checked {
  border-color: color-mix(in srgb, var(--focus-color) 70%, transparent);
  background: color-mix(in srgb, var(--focus-color) 25%, transparent);
  color: var(--focus-color);
}

.task-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;
  min-width: 0;
  cursor: pointer;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.task-title.line-through {
  text-decoration: line-through;
  color: rgba(255, 255, 255, 0.35);
}

.task-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 22px;
  padding-top: 2px;
  padding-bottom: 2px;
}

.task-date {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.05);
  padding: 1px 6px;
  border-radius: 4px;
}

.task-pomodoro {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
}

.task-pomodoro.completed-pomodoro {
  color: rgba(255, 255, 255, 0.3);
}

.task-group-badge {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.04);
  padding: 1px 6px 1px 4px;
  border-radius: 4px;
}

.task-play-btn {
  min-width: 20px;
  height: 20px;
  padding: 1px 4px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 600;
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--focus-color) 30%, transparent);
  color: var(--focus-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.task-play-btn:hover {
  background: color-mix(in srgb, var(--focus-color) 25%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 50%, transparent);
}

/* Timer display */
.task-timer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--focus-color) 10%, rgba(28, 28, 32, 0.8));
  border: 1px solid color-mix(in srgb, var(--focus-color) 25%, transparent);
  flex-shrink: 0;
}

.timer-phase {
  font-size: 10px;
  font-weight: 600;
  color: var(--focus-color);
  letter-spacing: 0.05em;
}

.timer-time {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #fff;
  min-width: 42px;
  text-align: center;
}

.timer-controls {
  display: flex;
  gap: 3px;
}

.timer-btn {
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

.timer-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.timer-btn.is-paused {
  background: color-mix(in srgb, var(--focus-color) 20%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 40%, transparent);
  color: var(--focus-color);
}

.done-btn {
  color: #3a9e6e;
}

.done-btn:hover {
  background: rgba(58, 158, 110, 0.15);
  border-color: rgba(58, 158, 110, 0.3);
  color: #4ade80;
}

.stop-btn {
  color: rgba(255, 255, 255, 0.4);
}

.stop-btn:hover {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.3);
  color: #f87171;
}

/* Subtask toggle button (next to play button) */
.subtask-toggle-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
  padding: 0;
  margin-left: 4px;
}

.subtask-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

.subtask-toggle-btn svg {
  transition: transform 0.2s;
}

.subtask-toggle-btn.expanded {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.7);
}

.subtask-toggle-btn.expanded svg {
  transform: rotate(180deg);
}

/* Subtasks */
.subtask-list {
  margin-top: 4px;
  margin-left: 22px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.subtask-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 6px;
  min-height: 28px;
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
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.2);
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
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtask-title.line-through {
  text-decoration: line-through;
  color: rgba(255, 255, 255, 0.3);
}

.subtask-play-btn {
  width: 20px;
  height: 20px;
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

/* Load more button */
.load-more-btn {
  display: block;
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.load-more-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.7);
}

/* Completed section */
.completed-section {
  margin-top: 12px;
  flex-shrink: 0;
}

.completed-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s;
  font-family: inherit;
  width: 100%;
  text-align: left;
}

.completed-header:hover {
  color: rgba(255, 255, 255, 0.6);
}

.completed-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Context menu */
.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 130px;
  padding: 4px;
  border-radius: 10px;
  background: rgba(28, 28, 32, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
}

.context-menu-item {
  display: block;
  width: 100%;
  padding: 7px 14px;
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

.context-menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.context-menu-item.danger {
  color: #f87171;
}

.context-menu-item.danger:hover {
  background: rgba(248, 113, 113, 0.12);
  color: #fca5a5;
}

.context-menu-item.flex-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.context-menu-item.submenu-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.context-menu-item-with-submenu {
  position: relative;
}

.context-sub-menu {
  position: absolute;
  left: 100%;
  top: -4px;
  min-width: 130px;
  padding: 4px;
  border-radius: 10px;
  background: rgba(28, 28, 32, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  display: none;
  z-index: 1010;
  margin-left: 4px;
}

.context-sub-menu.pos-left {
  left: auto;
  right: 100%;
  margin-left: 0;
  margin-right: 4px;
}

.context-menu-item-with-submenu:hover .context-sub-menu {
  display: block;
}

.context-menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 4px 8px;
}

.submenu-arrow {
  opacity: 0.4;
  font-size: 11px;
  line-height: 1;
}

.context-menu-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Collapse transition */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 1000px;
}

/* Categories Dropdown Container */
.tabs-dropdown-container {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.dropdown-trigger {
  position: relative;
  transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.dropdown-trigger:hover {
  transform: translateY(0.5px);
}

.dropdown-trigger.active {
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 40%, transparent);
  color: var(--focus-color);
  transform: rotate(180deg);
}

/* Dropdown Menu */
.tabs-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 140px;
  background: rgba(30, 30, 35, 0.85);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 5px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  transform-origin: top right;
  animation: dropdown-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dropdown-fade-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-5px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.tabs-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.tabs-dropdown-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.95);
  padding-left: 12px; /* Subtle hover slide-in micro-animation */
}

.tabs-dropdown-item.active {
  background: color-mix(in srgb, var(--focus-color) 12%, transparent);
  color: var(--focus-color);
  font-weight: 600;
}

.tabs-drop-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.tabs-drop-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1;
}

.tabs-drop-count {
  font-size: 9px;
  padding: 1.5px 5px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.tabs-dropdown-item:hover .tabs-drop-count {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
}

.tabs-dropdown-item.active .tabs-drop-count {
  background: color-mix(in srgb, var(--focus-color) 20%, transparent);
  color: var(--focus-color);
}

/* Completed tab: batch toolbar */
.batch-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.batch-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.batch-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.batch-select-all {
  width: 16px;
  height: 16px;
  border-radius: 5px;
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

.batch-select-all:hover {
  border-color: var(--focus-color);
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  color: var(--focus-color);
}

.batch-select-all.checked {
  border-color: color-mix(in srgb, var(--focus-color) 70%, transparent);
  background: color-mix(in srgb, var(--focus-color) 25%, transparent);
  color: var(--focus-color);
}

.batch-select-all.partial {
  border-color: color-mix(in srgb, var(--focus-color) 70%, transparent);
  background: color-mix(in srgb, var(--focus-color) 10%, transparent);
  color: var(--focus-color);
}

.batch-select-all .partial-bar {
  width: 8px;
  height: 2px;
  background: var(--focus-color);
  border-radius: 1px;
  display: block;
}

.batch-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.batch-hint:hover {
  color: rgba(255, 255, 255, 0.7);
}

.batch-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.batch-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.batch-btn.restore {
  color: color-mix(in srgb, var(--break-color) 80%, #fff);
  border-color: color-mix(in srgb, var(--break-color) 20%, rgba(255, 255, 255, 0.08));
}

.batch-btn.restore:hover {
  background: color-mix(in srgb, var(--break-color) 15%, transparent);
  border-color: color-mix(in srgb, var(--break-color) 35%, transparent);
  color: var(--break-color);
}

.batch-btn.danger {
  color: rgba(248, 113, 113, 0.8);
  border-color: rgba(248, 113, 113, 0.15);
}

.batch-btn.danger:hover {
  background: rgba(248, 113, 113, 0.12);
  border-color: rgba(248, 113, 113, 0.35);
  color: #fca5a5;
}

.batch-btn.subtle {
  background: transparent;
  border-color: transparent;
  color: rgba(255, 255, 255, 0.35);
}

.batch-btn.subtle:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.8);
}

.batch-btn.subtle.danger:hover {
  background: rgba(248, 113, 113, 0.1);
  color: #fca5a5;
}

/* Selected card highlight */
.task-card.is-selected {
  background: color-mix(in srgb, var(--focus-color) 8%, rgba(255, 255, 255, 0.05));
  border-color: color-mix(in srgb, var(--focus-color) 35%, transparent);
}

/* Batch-select checkbox beside each completed task */
.batch-checkbox {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border-width: 1.5px;
  margin-right: -2px;
}

.batch-checkbox.checked {
  border-color: color-mix(in srgb, var(--focus-color) 70%, transparent);
  background: color-mix(in srgb, var(--focus-color) 25%, transparent);
  color: var(--focus-color);
}
</style>
