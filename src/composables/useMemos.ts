import { ref, watch, computed } from 'vue'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { emitTo, listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

export interface Memo {
  id: string
  title: string
  content: string
  categoryId: string
  isPinned: boolean
  createdAt: number
  updatedAt: number
}

export interface MemoCategory {
  id: string
  name: string
  icon: string
  color: string
  isDefault: boolean
  order: number
}

const MEMOS_FILE = 'focus-island/memos.json'
const CATEGORIES_FILE = 'focus-island/memo-categories.json'

// Available category colors - use const object for stable references
export const CATEGORY_COLOR_MAP = {
  yellow: { id: 'yellow', bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.4)', icon: '#fbbf24' },
  green: { id: 'green', bg: 'rgba(74, 222, 128, 0.15)', border: 'rgba(74, 222, 128, 0.4)', icon: '#4ade80' },
  blue: { id: 'blue', bg: 'rgba(96, 165, 250, 0.15)', border: 'rgba(96, 165, 250, 0.4)', icon: '#60a5fa' },
  purple: { id: 'purple', bg: 'rgba(167, 139, 250, 0.15)', border: 'rgba(167, 139, 250, 0.4)', icon: '#a78bfa' },
  pink: { id: 'pink', bg: 'rgba(244, 114, 182, 0.15)', border: 'rgba(244, 114, 182, 0.4)', icon: '#f472b6' },
  orange: { id: 'orange', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.4)', icon: '#fb923c' },
  teal: { id: 'teal', bg: 'rgba(45, 212, 191, 0.15)', border: 'rgba(45, 212, 191, 0.4)', icon: '#2dd4bf' },
  slate: { id: 'slate', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.4)', icon: '#94a3b8' },
} as const

export type CategoryColorId = keyof typeof CATEGORY_COLOR_MAP

export const CATEGORY_COLORS = Object.values(CATEGORY_COLOR_MAP)

// Stable getter function
export function getCategoryColor(colorId: string) {
  return CATEGORY_COLOR_MAP[colorId as keyof typeof CATEGORY_COLOR_MAP] || CATEGORY_COLOR_MAP.yellow
}

const DEFAULT_CATEGORIES: MemoCategory[] = [
  { id: 'all', name: '全部', icon: 'folder', color: 'slate', isDefault: true, order: 0 },
  { id: 'work', name: '工作', icon: 'folder', color: 'blue', isDefault: true, order: 1 },
  { id: 'personal', name: '个人', icon: 'folder', color: 'green', isDefault: true, order: 2 },
  { id: 'study', name: '学习', icon: 'folder', color: 'purple', isDefault: true, order: 3 },
]

const memos = ref<Memo[]>([])
const categories = ref<MemoCategory[]>([...DEFAULT_CATEGORIES])
const loaded = ref(false)
const currentCategoryId = ref<string>('all')

let isSyncingMemos = false
let isSyncingCategories = false

async function loadMemos() {
  try {
    const raw = await readTextFile(MEMOS_FILE, { baseDir: BaseDirectory.AppData })
    memos.value = JSON.parse(raw)
  } catch {
    memos.value = []
  }
}

async function loadCategories() {
  try {
    const raw = await readTextFile(CATEGORIES_FILE, { baseDir: BaseDirectory.AppData })
    const parsed = JSON.parse(raw) as MemoCategory[]
    const defaultIds = new Set(DEFAULT_CATEGORIES.map(c => c.id))
    const customCategories = parsed.filter(c => !defaultIds.has(c.id))
    categories.value = [...DEFAULT_CATEGORIES, ...customCategories].sort((a, b) => a.order - b.order)
  } catch {
    categories.value = [...DEFAULT_CATEGORIES]
  }
}

async function load() {
  await Promise.all([loadMemos(), loadCategories()])
  loaded.value = true
}

async function saveMemos() {
  if (!loaded.value || isSyncingMemos) return
  try {
    await mkdir('focus-island', { baseDir: BaseDirectory.AppData, recursive: true })
    const json = JSON.stringify(memos.value)
    await writeTextFile(MEMOS_FILE, json, { baseDir: BaseDirectory.AppData })
    const self = getCurrentWebviewWindow().label
    const targets = self === 'main' ? ['panel'] : ['main']
    for (const target of targets) {
      emitTo(target, 'memos-updated', json).catch(() => {})
    }
  } catch (e) {
    console.error('Failed to save memos', e)
  }
}

async function saveCategories() {
  if (!loaded.value || isSyncingCategories) return
  try {
    await mkdir('focus-island', { baseDir: BaseDirectory.AppData, recursive: true })
    const json = JSON.stringify(categories.value)
    await writeTextFile(CATEGORIES_FILE, json, { baseDir: BaseDirectory.AppData })
    const self = getCurrentWebviewWindow().label
    const targets = self === 'main' ? ['panel'] : ['main']
    for (const target of targets) {
      emitTo(target, 'memo-categories-updated', json).catch(() => {})
    }
  } catch (e) {
    console.error('Failed to save memo categories', e)
  }
}

watch(memos, saveMemos, { deep: true })
watch(categories, saveCategories, { deep: true })

listen<string>('memos-updated', (event) => {
  try {
    isSyncingMemos = true
    memos.value = JSON.parse(event.payload)
    setTimeout(() => { isSyncingMemos = false }, 50)
  } catch { /* ignore */ }
})

listen<string>('memo-categories-updated', (event) => {
  try {
    isSyncingCategories = true
    categories.value = JSON.parse(event.payload)
    setTimeout(() => { isSyncingCategories = false }, 50)
  } catch { /* ignore */ }
})

function extractTitleFromContent(content: string, maxLength: number = 10): string {
  const plainText = content.replace(/<[^>]+>/g, '').trim()
  if (plainText.length === 0) return '无标题'
  return plainText.slice(0, maxLength) + (plainText.length > maxLength ? '...' : '')
}

export function useMemos() {
  if (!loaded.value) load()

  function addMemo(categoryId: string = 'all'): Memo {
    const now = Date.now()
    const actualCategoryId = categoryId === 'all' ? 'work' : categoryId
    const memo: Memo = {
      id: crypto.randomUUID(),
      title: '',
      content: '',
      categoryId: actualCategoryId,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
    }
    memos.value.unshift(memo)
    return memo
  }

  function updateMemo(id: string, patch: Partial<Pick<Memo, 'title' | 'content' | 'categoryId' | 'isPinned'>>) {
    const memo = memos.value.find(m => m.id === id)
    if (!memo) return
    Object.assign(memo, patch)
    memo.updatedAt = Date.now()
  }

  function deleteMemo(id: string) {
    memos.value = memos.value.filter(m => m.id !== id)
  }

  function togglePin(id: string) {
    const memo = memos.value.find(m => m.id === id)
    if (!memo) return
    memo.isPinned = !memo.isPinned
    memo.updatedAt = Date.now()
  }

  function addCategory(name: string, color: string = 'yellow'): MemoCategory | null {
    const trimmedName = name.trim()
    if (!trimmedName) return null
    const existing = categories.value.find(c => c.name === trimmedName)
    if (existing) return null
    const maxOrder = Math.max(...categories.value.map(c => c.order), 0)
    const category: MemoCategory = {
      id: crypto.randomUUID(),
      name: trimmedName,
      icon: 'folder',
      color,
      isDefault: false,
      order: maxOrder + 1,
    }
    categories.value.push(category)
    return category
  }

  function updateCategory(id: string, name: string): boolean {
    const trimmedName = name.trim()
    if (!trimmedName) return false
    const category = categories.value.find(c => c.id === id)
    if (!category || category.isDefault) return false
    const existing = categories.value.find(c => c.name === trimmedName && c.id !== id)
    if (existing) return false
    category.name = trimmedName
    return true
  }

  function deleteCategory(id: string): boolean {
    const category = categories.value.find(c => c.id === id)
    if (!category || category.isDefault) return false
    memos.value.forEach(memo => {
      if (memo.categoryId === id) {
        memo.categoryId = 'all'
        memo.updatedAt = Date.now()
      }
    })
    categories.value = categories.value.filter(c => c.id !== id)
    if (currentCategoryId.value === id) {
      currentCategoryId.value = 'all'
    }
    return true
  }

  const filteredMemos = computed(() => {
    let result = memos.value
    if (currentCategoryId.value !== 'all') {
      result = result.filter(m => m.categoryId === currentCategoryId.value)
    }
    return result.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
  })

  const currentCategoryName = computed(() => {
    const category = categories.value.find(c => c.id === currentCategoryId.value)
    return category?.name ?? '全部'
  })

  const memoCount = computed(() => {
    if (currentCategoryId.value === 'all') {
      return memos.value.length
    }
    return memos.value.filter(m => m.categoryId === currentCategoryId.value).length
  })

  function getDisplayTitle(memo: Memo): string {
    if (memo.title.trim()) return memo.title.trim()
    return extractTitleFromContent(memo.content)
  }

  return {
    memos,
    categories,
    currentCategoryId,
    filteredMemos,
    currentCategoryName,
    memoCount,
    addMemo,
    updateMemo,
    deleteMemo,
    togglePin,
    addCategory,
    updateCategory,
    deleteCategory,
    getDisplayTitle,
  }
}
