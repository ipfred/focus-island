# 备忘录功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现备忘录功能，支持分类管理、富文本编辑、置顶、图片插入，采用单栏布局适配 panel 窗口

**Architecture:** 单栏布局（列表页↔编辑页切换），数据使用 tauri-plugin-fs 持久化，模块级单例状态管理（仿 useTasks.ts），富文本基于 contenteditable 实现

**Tech Stack:** Vue 3 + TypeScript + TailwindCSS v4 + Tauri 2.x

---

## 文件结构

**新增文件：**
- `src/composables/useMemos.ts` - 备忘录状态管理（模块级单例、持久化）
- `src/panel/MemoPage.vue` - 备忘录主页面（列表+编辑页切换）
- `src/panel/MemoEditor.vue` - 富文本编辑器组件
- `src/panel/MemoCategoryDialog.vue` - 分类管理弹窗

**修改文件：**
- `src/panel/PanelApp.vue` - 添加 'memos' 视图
- `src/panel/TaskArea.vue` - 底部添加备忘录入口按钮

---

## Task 1: 创建 useMemos composable（数据层）

**Files:**
- Create: `src/composables/useMemos.ts`

### Step 1.1: 定义类型和常量

```typescript
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
  isDefault: boolean
  order: number
}

const MEMOS_FILE = 'focus-island/memos.json'
const CATEGORIES_FILE = 'focus-island/memo-categories.json'

const defaultCategories: MemoCategory[] = [
  { id: 'all', name: '全部', icon: '📋', isDefault: true, order: 0 },
  { id: 'work', name: '工作', icon: '💼', isDefault: true, order: 1 },
  { id: 'personal', name: '个人', icon: '🏠', isDefault: true, order: 2 },
  { id: 'study', name: '学习', icon: '📚', isDefault: true, order: 3 },
]
```

### Step 1.2: 创建模块级单例状态

```typescript
const memos = ref<Memo[]>([])
const categories = ref<MemoCategory[]>([...defaultCategories])
const loaded = ref(false)
const currentCategoryId = ref('all')
let isSyncing = false
```

### Step 1.3: 实现加载函数

```typescript
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
    categories.value = JSON.parse(raw)
  } catch {
    categories.value = [...defaultCategories]
  }
}

async function load() {
  await Promise.all([loadMemos(), loadCategories()])
  loaded.value = true
}
```

### Step 1.4: 实现保存函数

```typescript
async function saveMemos() {
  if (!loaded.value || isSyncing) return
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
  if (!loaded.value) return
  try {
    await mkdir('focus-island', { baseDir: BaseDirectory.AppData, recursive: true })
    await writeTextFile(CATEGORIES_FILE, JSON.stringify(categories.value), { baseDir: BaseDirectory.AppData })
  } catch (e) {
    console.error('Failed to save categories', e)
  }
}

watch(memos, saveMemos, { deep: true })
watch(categories, saveCategories, { deep: true })

listen<string>('memos-updated', (event) => {
  try {
    isSyncing = true
    memos.value = JSON.parse(event.payload)
    setTimeout(() => { isSyncing = false }, 50)
  } catch {}
})
```

### Step 1.5: 实现核心方法

```typescript
export function useMemos() {
  if (!loaded.value) load()

  function addMemo(categoryId: string = 'all'): Memo {
    const now = Date.now()
    const memo: Memo = {
      id: crypto.randomUUID(),
      title: '',
      content: '',
      categoryId: categoryId === 'all' ? 'work' : categoryId,
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
    if (memo) {
      memo.isPinned = !memo.isPinned
      memo.updatedAt = Date.now()
    }
  }

  function addCategory(name: string): MemoCategory {
    const category: MemoCategory = {
      id: crypto.randomUUID(),
      name: name.trim(),
      icon: '📄',
      isDefault: false,
      order: categories.value.length,
    }
    categories.value.push(category)
    return category
  }

  function updateCategory(id: string, name: string) {
    const category = categories.value.find(c => c.id === id)
    if (category && !category.isDefault) {
      category.name = name.trim()
    }
  }

  function deleteCategory(id: string) {
    const category = categories.value.find(c => c.id === id)
    if (!category || category.isDefault) return
    
    memos.value.forEach(memo => {
      if (memo.categoryId === id) {
        memo.categoryId = 'all'
        memo.updatedAt = Date.now()
      }
    })
    categories.value = categories.value.filter(c => c.id !== id)
  }

  const filteredMemos = computed(() => {
    let result = memos.value
    if (currentCategoryId.value !== 'all') {
      result = result.filter(m => m.categoryId === currentCategoryId.value)
    }
    return [...result].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
  })

  const currentCategoryName = computed(() => {
    const cat = categories.value.find(c => c.id === currentCategoryId.value)
    return cat?.name ?? '全部'
  })

  const memoCount = computed(() => {
    if (currentCategoryId.value === 'all') return memos.value.length
    return memos.value.filter(m => m.categoryId === currentCategoryId.value).length
  })

  function getDisplayTitle(memo: Memo): string {
    if (memo.title.trim()) return memo.title.trim()
    const text = memo.content.replace(/<[^>]+>/g, '').trim()
    if (!text) return '无标题'
    return text.slice(0, 10) + (text.length > 10 ? '...' : '')
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
```

### Step 1.6: 提交

```bash
git add src/composables/useMemos.ts
git commit -m "feat: add useMemos composable for memo state management"
```

---

## Task 2: 创建 MemoCategoryDialog 分类管理弹窗

**Files:**
- Create: `src/panel/MemoCategoryDialog.vue`

### Step 2.1: 模板结构

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useMemos, type MemoCategory } from '../composables/useMemos'

const emit = defineEmits<{ close: [] }>()
const { categories, addCategory, updateCategory, deleteCategory } = useMemos()

const editingId = ref<string | null>(null)
const editingName = ref('')
const newName = ref('')

function startEdit(category: MemoCategory) {
  editingId.value = category.id
  editingName.value = category.name
}

function saveEdit() {
  if (editingId.value && editingName.value.trim()) {
    updateCategory(editingId.value, editingName.value.trim())
  }
  editingId.value = null
  editingName.value = ''
}

function handleAdd() {
  if (newName.value.trim()) {
    addCategory(newName.value.trim())
    newName.value = ''
  }
}

function handleDelete(category: MemoCategory) {
  if (confirm(`删除分类"${category.name}"？该分类下的备忘录将移至"全部"。`)) {
    deleteCategory(category.id)
  }
}
</script>

<template>
  <div class="dialog-overlay" @click="emit('close')">
    <div class="dialog-content" @click.stop>
      <div class="dialog-header">
        <span class="dialog-title">分类管理</span>
        <button class="close-btn" @click="emit('close')">×</button>
      </div>
      
      <div class="category-list">
        <div v-for="category in categories" :key="category.id" class="category-item">
          <span class="category-icon">{{ category.icon }}</span>
          
          <template v-if="editingId === category.id">
            <input
              v-model="editingName"
              class="edit-input"
              @keydown.enter="saveEdit"
              @keydown.esc="editingId = null"
              @blur="saveEdit"
              autofocus
            />
          </template>
          <span v-else class="category-name">{{ category.name }}</span>
          
          <span v-if="category.isDefault" class="default-badge">默认</span>
          
          <div class="item-actions">
            <button 
              v-if="!category.isDefault" 
              class="action-btn" 
              @click="startEdit(category)"
              title="重命名"
            >
              ✎
            </button>
            <button 
              v-if="!category.isDefault" 
              class="action-btn delete" 
              @click="handleDelete(category)"
              title="删除"
            >
              ×
            </button>
          </div>
        </div>
      </div>
      
      <div class="add-section">
        <input
          v-model="newName"
          class="add-input"
          placeholder="新建分类名称"
          @keydown.enter="handleAdd"
        />
        <button class="add-btn" @click="handleAdd">+ 新建</button>
      </div>
    </div>
  </div>
</template>
```

### Step 2.2: 样式

```vue
<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog-content {
  background: linear-gradient(180deg, rgba(28, 28, 32, 0.98), rgba(22, 22, 26, 0.97));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  width: 320px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.dialog-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.close-btn:hover {
  color: #fff;
}

.category-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  transition: background 0.2s;
}

.category-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.category-icon {
  font-size: 14px;
}

.category-name {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

.default-badge {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
}

.item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.category-item:hover .item-actions {
  opacity: 1;
}

.action-btn {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.action-btn.delete:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.1);
}

.edit-input, .add-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 6px 10px;
  color: #fff;
  font-size: 13px;
  outline: none;
}

.edit-input:focus, .add-input:focus {
  border-color: var(--focus-color);
}

.add-section {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.add-btn {
  background: var(--focus-color);
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  color: #000;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.add-btn:hover {
  opacity: 0.9;
}

.category-list::-webkit-scrollbar { width: 4px; }
.category-list::-webkit-scrollbar-track { background: transparent; }
.category-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
</style>
```

### Step 2.3: 提交

```bash
git add src/panel/MemoCategoryDialog.vue
git commit -m "feat: add memo category management dialog"
```

---

## Task 3: 创建 MemoEditor 富文本编辑器

**Files:**
- Create: `src/panel/MemoEditor.vue`

### Step 3.1: 脚本和模板结构

```vue
<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import type { Memo, MemoCategory } from '../composables/useMemos'

const props = defineProps<{
  memo: Memo
  categories: MemoCategory[]
}>()

const emit = defineEmits<{
  update: [patch: Partial<Pick<Memo, 'title' | 'content' | 'categoryId' | 'isPinned'>>]
  delete: []
  back: []
}>()

const titleInput = ref<HTMLInputElement | null>(null)
const contentRef = ref<HTMLDivElement | null>(null)
const saveStatus = ref('已保存')

onMounted(() => {
  nextTick(() => {
    titleInput.value?.focus()
    if (contentRef.value && props.memo.content) {
      contentRef.value.innerHTML = props.memo.content
    }
  })
})

function onTitleChange(e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update', { title: value })
  saveStatus.value = '已保存'
}

function onCategoryChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value
  emit('update', { categoryId: value })
}

function execCommand(command: string, value: string = '') {
  document.execCommand(command, false, value)
  contentRef.value?.focus()
}

function onContentInput() {
  const html = contentRef.value?.innerHTML || ''
  emit('update', { content: html })
  saveStatus.value = '已保存'
}

async function insertImage() {
  const selected = await open({
    multiple: false,
    filters: [{
      name: '图片',
      extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
    }]
  })
  
  if (!selected || Array.isArray(selected)) return
  
  try {
    const response = await fetch(selected.path)
    const blob = await response.blob()
    
    if (blob.size > 2 * 1024 * 1024) {
      alert('图片过大，请选择小于 2MB 的图片')
      return
    }
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = e.target?.result as string
      execCommand('insertImage', base64)
    }
    reader.readAsDataURL(blob)
  } catch (e) {
    console.error('Failed to insert image', e)
  }
}

function insertCheckbox() {
  const html = '<input type="checkbox" style="margin-right: 8px;">'
  execCommand('insertHTML', html)
}

function insertDivider() {
  execCommand('insertHTML', '<hr style="border: none; border-top: 1px solid rgba(255,255,255,0.15); margin: 12px 0;">')
}

const colors = ['#fff', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6']
const showColorPicker = ref(false)

function applyColor(color: string) {
  execCommand('foreColor', color)
  showColorPicker.value = false
}
</script>

<template>
  <div class="memo-editor">
    <!-- 顶部栏 -->
    <div class="editor-header">
      <button class="back-btn" @click="emit('back')">← 返回</button>
      <div class="header-actions">
        <button 
          class="pin-btn" 
          :class="{ pinned: memo.isPinned }"
          @click="emit('update', { isPinned: !memo.isPinned })"
        >
          {{ memo.isPinned ? '★ 已置顶' : '☆ 置顶' }}
        </button>
        <button class="delete-btn" @click="emit('delete')">🗑</button>
      </div>
    </div>
    
    <!-- 标题 -->
    <input
      ref="titleInput"
      class="title-input"
      :value="memo.title"
      placeholder="输入标题..."
      @input="onTitleChange"
    />
    
    <!-- 分类和状态 -->
    <div class="meta-row">
      <select class="category-select" :value="memo.categoryId" @change="onCategoryChange">
        <option v-for="cat in categories" :key="cat.id" :value="cat.id">
          {{ cat.icon }} {{ cat.name }}
        </option>
      </select>
      <span class="save-status">{{ saveStatus }}</span>
    </div>
    
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-group">
        <button class="tool-btn" @click="execCommand('bold')" title="粗体">B</button>
        <button class="tool-btn italic" @click="execCommand('italic')" title="斜体">I</button>
      </div>
      
      <div class="toolbar-divider"></div>
      
      <div class="toolbar-group color-group">
        <button class="tool-btn" @click="showColorPicker = !showColorPicker" title="文字颜色">Aa</button>
        <div v-if="showColorPicker" class="color-picker">
          <button
            v-for="color in colors"
            :key="color"
            class="color-option"
            :style="{ background: color }"
            @click="applyColor(color)"
          />
        </div>
      </div>
      
      <div class="toolbar-divider"></div>
      
      <div class="toolbar-group">
        <button class="tool-btn" @click="insertCheckbox" title="复选框">☑</button>
        <button class="tool-btn" @click="insertDivider" title="分割线">─</button>
        <button class="tool-btn" @click="insertImage" title="插入图片">🖼</button>
      </div>
    </div>
    
    <!-- 编辑区 -->
    <div
      ref="contentRef"
      class="content-editor"
      contenteditable="true"
      placeholder="点击输入内容..."
      @input="onContentInput"
    ></div>
  </div>
</template>
```

### Step 3.2: 样式

```vue
<style scoped>
.memo-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.back-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: all 0.2s;
}

.back-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.pin-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 6px 12px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.pin-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.pin-btn.pinned {
  background: color-mix(in srgb, var(--focus-color) 20%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 40%, transparent);
  color: var(--focus-color);
}

.delete-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 6px 10px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  cursor: pointer;
}

.delete-btn:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.1);
}

.title-input {
  background: none;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 14px 16px;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  outline: none;
  flex-shrink: 0;
}

.title-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.category-select {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 6px 10px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  cursor: pointer;
  outline: none;
}

.category-select option {
  background: #1c1c20;
  color: #fff;
}

.save-status {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  position: relative;
}

.toolbar-group {
  display: flex;
  gap: 4px;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
}

.tool-btn {
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.tool-btn.italic {
  font-style: italic;
  font-family: Georgia, serif;
}

.color-group {
  position: relative;
}

.color-picker {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 6px;
  background: rgba(30, 30, 35, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  gap: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 10;
}

.color-option {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
}

.color-option:hover {
  transform: scale(1.1);
}

.content-editor {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  line-height: 1.6;
  outline: none;
}

.content-editor:empty::before {
  content: attr(placeholder);
  color: rgba(255, 255, 255, 0.3);
}

.content-editor :deep(img) {
  max-width: 100%;
  border-radius: 6px;
  margin: 8px 0;
}

.content-editor :deep(input[type="checkbox"]) {
  margin-right: 8px;
  accent-color: var(--focus-color);
}

.content-editor :deep(hr) {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  margin: 12px 0;
}

.content-editor :deep(b), .content-editor :deep(strong) {
  font-weight: 600;
}

.content-editor::-webkit-scrollbar { width: 4px; }
.content-editor::-webkit-scrollbar-track { background: transparent; }
.content-editor::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
</style>
```

### Step 3.3: 提交

```bash
git add src/panel/MemoEditor.vue
git commit -m "feat: add memo editor with rich text support"
```

---

## Task 4: 创建 MemoPage 主页面

**Files:**
- Create: `src/panel/MemoPage.vue`

### Step 4.1: 脚本和模板结构

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMemos } from '../composables/useMemos'
import MemoEditor from './MemoEditor.vue'
import MemoCategoryDialog from './MemoCategoryDialog.vue'

const emit = defineEmits<{ back: [] }>()

const { 
  memos, 
  categories, 
  currentCategoryId, 
  filteredMemos, 
  currentCategoryName, 
  memoCount,
  addMemo, 
  updateMemo, 
  deleteMemo,
  getDisplayTitle 
} = useMemos()

const editingMemoId = ref<string | null>(null)
const showCategoryDialog = ref(false)

const editingMemo = computed(() => {
  if (!editingMemoId.value) return null
  return memos.value.find(m => m.id === editingMemoId.value) || null
})

function startNewMemo() {
  const memo = addMemo(currentCategoryId.value)
  editingMemoId.value = memo.id
}

function startEdit(memoId: string) {
  editingMemoId.value = memoId
}

function handleUpdate(patch: Parameters<typeof updateMemo>[1]) {
  if (editingMemoId.value) {
    updateMemo(editingMemoId.value, patch)
  }
}

function handleDelete() {
  if (editingMemoId.value && confirm('确定删除这条备忘录？')) {
    deleteMemo(editingMemoId.value)
    editingMemoId.value = null
  }
}

function backToList() {
  editingMemoId.value = null
}

function formatTime(timestamp: number): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diff = now.getTime() - timestamp
  const isSameDay = (a: Date, b: Date) => 
    a.getFullYear() === b.getFullYear() && 
    a.getMonth() === b.getMonth() && 
    a.getDate() === b.getDate()
  const isYesterday = (d: Date) => {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return isSameDay(d, yesterday)
  }
  
  if (isSameDay(now, date)) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  if (isYesterday(date)) {
    return '昨天'
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    return weekdays[date.getDay()]
  }
  return `${date.getMonth() + 1}-${date.getDate()}`
}

function getPreview(content: string): string {
  const text = content.replace(/<[^>]+>/g, '').trim()
  return text.slice(0, 40) + (text.length > 40 ? '...' : '')
}
</script>

<template>
  <div class="memo-page">
    <!-- 列表页 -->
    <template v-if="!editingMemoId">
      <!-- 顶部栏 -->
      <div class="page-header">
        <span class="page-title">📝 备忘录</span>
        <button class="new-btn" @click="startNewMemo">+</button>
      </div>
      
      <!-- 搜索框（预留） -->
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" class="search-input" placeholder="搜索备忘录（即将上线）" disabled />
      </div>
      
      <!-- 分类选择栏 -->
      <div class="category-bar">
        <div class="category-select-wrapper">
          <select class="category-dropdown" v-model="currentCategoryId">
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.icon }} {{ cat.name }}
            </option>
          </select>
          <button class="manage-categories-btn" @click="showCategoryDialog = true" title="管理分类">
            ⚙
          </button>
        </div>
        <span class="memo-count">共 {{ memoCount }} 条</span>
      </div>
      
      <!-- 备忘录列表 -->
      <div class="memo-list">
        <div v-if="filteredMemos.length === 0" class="empty-state">
          <span class="empty-icon">📝</span>
          <span class="empty-text">暂无备忘录</span>
          <button class="empty-action" @click="startNewMemo">新建一条</button>
        </div>
        
        <div
          v-for="memo in filteredMemos"
          :key="memo.id"
          class="memo-item"
          :class="{ pinned: memo.isPinned }"
          @click="startEdit(memo.id)"
        >
          <div class="item-header">
            <span v-if="memo.isPinned" class="pin-icon">★</span>
            <span class="item-title">{{ getDisplayTitle(memo) }}</span>
            <span class="item-time">{{ formatTime(memo.updatedAt) }}</span>
          </div>
          <div class="item-preview">{{ getPreview(memo.content) || '无内容' }}</div>
        </div>
      </div>
      
      <!-- 返回按钮 -->
      <button class="back-to-tasks" @click="emit('back')">
        ← 返回任务列表
      </button>
    </template>
    
    <!-- 编辑页 -->
    <MemoEditor
      v-else-if="editingMemo"
      :memo="editingMemo"
      :categories="categories"
      @update="handleUpdate"
      @delete="handleDelete"
      @back="backToList"
    />
    
    <!-- 分类管理弹窗 -->
    <MemoCategoryDialog v-if="showCategoryDialog" @close="showCategoryDialog = false" />
  </div>
</template>
```

### Step 4.2: 样式

```vue
<style scoped>
.memo-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #e8e8ea;
}

/* 顶部栏 */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.page-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.new-btn {
  width: 28px;
  height: 28px;
  background: var(--focus-color);
  border: none;
  border-radius: 50%;
  color: #000;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}

.new-btn:hover {
  opacity: 0.9;
}

/* 搜索框 */
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 16px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  flex-shrink: 0;
}

.search-icon {
  font-size: 12px;
  opacity: 0.4;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
  outline: none;
}

.search-input:disabled {
  cursor: not-allowed;
}

/* 分类栏 */
.category-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.category-select-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.category-dropdown {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 6px 10px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  cursor: pointer;
  outline: none;
}

.category-dropdown option {
  background: #1c1c20;
  color: #fff;
}

.manage-categories-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 6px 8px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
}

.manage-categories-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.memo-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

/* 列表 */
.memo-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.memo-list::-webkit-scrollbar { width: 4px; }
.memo-list::-webkit-scrollbar-track { background: transparent; }
.memo-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
}

.empty-icon {
  font-size: 40px;
  opacity: 0.3;
}

.empty-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
}

.empty-action {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 8px 16px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  margin-top: 8px;
}

.empty-action:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.memo-item {
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.memo-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.memo-item.pinned {
  border-color: color-mix(in srgb, var(--focus-color) 25%, transparent);
  background: color-mix(in srgb, var(--focus-color) 5%, rgba(255,255,255,0.035));
}

.item-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.pin-icon {
  color: var(--focus-color);
  font-size: 12px;
}

.item-title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

.item-preview {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.back-to-tasks {
  background: rgba(255, 255, 255, 0.06);
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.back-to-tasks:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
</style>
```

### Step 4.3: 提交

```bash
git add src/panel/MemoPage.vue
git commit -m "feat: add memo page with list and editor views"
```

---

## Task 5: 集成到 PanelApp.vue

**Files:**
- Modify: `src/panel/PanelApp.vue`

### Step 5.1: 导入和类型修改

在 `<script setup>` 顶部添加导入：

```typescript
import MemoPage from './MemoPage.vue'
```

修改 currentView 类型：

```typescript
const currentView = ref<'tasks' | 'settings' | 'completed' | 'memos'>('tasks')
```

### Step 5.2: 添加模板

在 `<template>` 中的 transition 内添加：

```vue
<MemoPage v-else-if="currentView === 'memos'" @back="currentView = 'tasks'" />
```

完整 transition 部分应如下：

```vue
<transition name="slide-right" mode="out-in">
  <TaskArea 
    v-if="currentView === 'tasks'" 
    category="today" 
    @close="closeWindow" 
    @settings="currentView = 'settings'" 
    @completed="currentView = 'completed'"
    @memos="currentView = 'memos'" 
  />
  <SettingsPage v-else-if="currentView === 'settings'" @back="currentView = 'tasks'" />
  <CompletedPage v-else-if="currentView === 'completed'" @back="currentView = 'tasks'" />
  <MemoPage v-else-if="currentView === 'memos'" @back="currentView = 'tasks'" />
</transition>
```

### Step 5.3: 提交

```bash
git add src/panel/PanelApp.vue
git commit -m "feat: integrate memo page into panel app"
```

---

## Task 6: 集成到 TaskArea.vue

**Files:**
- Modify: `src/panel/TaskArea.vue`

### Step 6.1: 修改 emit 定义

找到 emit 定义，添加 memos：

```typescript
const emit = defineEmits<{ close: []; settings: []; completed: []; memos: [] }>()
```

### Step 6.2: 添加备忘录按钮

在 footer-actions 区域，在"已完成"按钮前添加备忘录按钮：

```vue
<button
  class="footer-btn"
  title="备忘录"
  @click="emit('memos')"
>
  📝 备忘录
</button>
```

footer-actions 区域应如下：

```vue
<div class="footer-actions">
  <button
    class="footer-btn"
    title="备忘录"
    @click="emit('memos')"
  >
    📝 备忘录
  </button>
  <button
    class="footer-btn"
    title="已完成任务"
    @click="emit('completed')"
  >
    ✓ 已完成{{
      completedCount > 0 ? ` (${completedCount})` : ""
    }}
  </button>
  <button
    class="footer-btn"
    title="设置"
    @click="emit('settings')"
  >
    ⚙
  </button>
</div>
```

### Step 6.3: 提交

```bash
git add src/panel/TaskArea.vue
git commit -m "feat: add memo button to task area footer"
```

---

## Task 7: 功能验证

**Files:**
- All modified files

### Step 7.1: 类型检查

```bash
npx vue-tsc --noEmit
```

Expected: No errors

### Step 7.2: 开发测试

```bash
npm run dev
```

手动测试清单：
- [ ] 点击底部"📝 备忘录"按钮进入备忘录页面
- [ ] 点击"+"新建备忘录
- [ ] 输入标题和内容
- [ ] 测试富文本工具栏（粗体、斜体、颜色、复选框、分割线）
- [ ] 测试插入图片（选择小于 2MB 的图片）
- [ ] 点击"置顶"按钮
- [ ] 返回列表，验证置顶项显示在顶部
- [ ] 切换分类筛选
- [ ] 管理分类（添加、重命名、删除）
- [ ] 删除备忘录
- [ ] 验证数据持久化（重启应用后数据仍在）

### Step 7.3: 提交所有更改

```bash
git add .
git commit -m "feat: complete memo feature implementation"
```

---

## 总结

本计划实现了完整的备忘录功能：

1. **useMemos.ts** - 数据层，支持增删改查、分类管理、置顶排序
2. **MemoCategoryDialog.vue** - 分类管理弹窗
3. **MemoEditor.vue** - 富文本编辑器（粗体、斜体、颜色、复选框、分割线、图片）
4. **MemoPage.vue** - 主页面（单栏布局，列表+编辑页切换）
5. **PanelApp.vue/TaskArea.vue** - 集成入口

特性：
- 标题自动提取（空标题时从内容取前10字）
- 图片 base64 存储，2MB 限制
- 置顶排序优先
- 分类筛选 + 条数显示
- 预留搜索框
- 响应式单栏布局适配 panel 窗口
