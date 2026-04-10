<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
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

// Local state
const localTitle = ref(props.memo.title)
const localContent = ref(props.memo.content)
const localCategoryId = ref(props.memo.categoryId)
const localIsPinned = ref(props.memo.isPinned)
const saveStatus = ref<'saved' | 'saving' | 'unsaved'>('saved')
const editorRef = ref<HTMLDivElement | null>(null)
const titleInputRef = ref<HTMLInputElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const saveTimeout = ref<number | null>(null)
const showDeleteConfirm = ref(false)

// Sync local state when memo changes
watch(() => props.memo, (newMemo) => {
  localTitle.value = newMemo.title
  localContent.value = newMemo.content
  localCategoryId.value = newMemo.categoryId
  localIsPinned.value = newMemo.isPinned
}, { deep: true })

// Auto-save on changes
function scheduleSave() {
  saveStatus.value = 'unsaved'
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
  }
  saveTimeout.value = window.setTimeout(() => {
    doSave()
  }, 800)
}

function doSave() {
  saveStatus.value = 'saving'
  emit('update', {
    title: localTitle.value,
    content: localContent.value,
    categoryId: localCategoryId.value,
    isPinned: localIsPinned.value,
  })
  // Simulate brief saving state then show saved
  setTimeout(() => {
    saveStatus.value = 'saved'
  }, 200)
}

// Title input handlers
function onTitleInput() {
  scheduleSave()
}

function onTitleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    editorRef.value?.focus()
  }
}

// Category change
function onCategoryChange() {
  scheduleSave()
}

// Pin toggle
function togglePin() {
  localIsPinned.value = !localIsPinned.value
  scheduleSave()
}

// Rich text editing commands
function execCommand(command: string, value: string | undefined = undefined) {
  document.execCommand(command, false, value)
  editorRef.value?.focus()
  onContentChange()
}

function toggleBold() {
  execCommand('bold')
}

function toggleItalic() {
  execCommand('italic')
}

function setTextColor(color: string) {
  execCommand('foreColor', color)
}

function insertCheckbox() {
  const checkboxHtml = '<div class="memo-checkbox-item"><input type="checkbox" class="memo-checkbox" onclick="this.setAttribute(\'checked\', this.checked ? \'\' : null)"><span class="memo-checkbox-text">&nbsp;</span></div><div><br></div>'
  execCommand('insertHTML', checkboxHtml)
}

function insertDivider() {
  execCommand('insertHTML', '<hr class="memo-divider"><div><br></div>')
}

function triggerImageUpload() {
  fileInputRef.value?.click()
}

function handleImageSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // Check file size (2MB limit)
  if (file.size > 2 * 1024 * 1024) {
    alert('图片大小不能超过 2MB')
    input.value = ''
    return
  }

  // Check file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    alert('仅支持 png, jpg, jpeg, gif, webp 格式的图片')
    input.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const base64 = e.target?.result as string
    const imgHtml = `<img src="${base64}" class="memo-image" style="max-width: 100%; border-radius: 8px; margin: 8px 0;"><div><br></div>`
    execCommand('insertHTML', imgHtml)
  }
  reader.readAsDataURL(file)

  // Reset input
  input.value = ''
}

// Content change handler
function onContentChange() {
  if (editorRef.value) {
    localContent.value = editorRef.value.innerHTML
  }
  scheduleSave()
}

// Handle paste (strip formatting optionally)
function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') || ''
  const html = e.clipboardData?.getData('text/html') || ''

  // If HTML is available and not too complex, use it
  if (html && !html.includes('<script')) {
    document.execCommand('insertHTML', false, html)
  } else {
    document.execCommand('insertText', false, text)
  }
  onContentChange()
}

// Delete confirmation
function handleDelete() {
  showDeleteConfirm.value = true
}

function confirmDelete() {
  showDeleteConfirm.value = false
  emit('delete')
}

function cancelDelete() {
  showDeleteConfirm.value = false
}

// Back handler
function handleBack() {
  doSave()
  emit('back')
}

// Keyboard shortcuts
function onEditorKeydown(e: KeyboardEvent) {
  // Ctrl/Cmd + B for bold
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault()
    toggleBold()
  }
  // Ctrl/Cmd + I for italic
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault()
    toggleItalic()
  }
  // Ctrl/Cmd + S for save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    doSave()
  }
}

// Initialize editor content
onMounted(() => {
  if (editorRef.value) {
    editorRef.value.innerHTML = localContent.value || '<div><br></div>'
  }
  titleInputRef.value?.focus()
})

// Cleanup
onBeforeUnmount(() => {
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
  }
  doSave()
})

// Get category name by id
function getCategoryName(categoryId: string): string {
  const category = props.categories.find(c => c.id === categoryId)
  return category?.name || '未分类'
}
</script>

<template>
  <div class="memo-editor">
    <!-- Top Bar -->
    <div class="editor-top-bar">
      <button class="top-bar-btn back-btn" @click="handleBack" title="返回">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>

      <div class="top-bar-actions">
        <button
          class="top-bar-btn pin-btn"
          :class="{ 'is-pinned': localIsPinned }"
          @click="togglePin"
          :title="localIsPinned ? '取消置顶' : '置顶'"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v8M5 10h14M9 21h6M12 10v11"/>
          </svg>
        </button>

        <button class="top-bar-btn delete-btn" @click="handleDelete" title="删除">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Title Input -->
    <div class="editor-title-area">
      <input
        ref="titleInputRef"
        v-model="localTitle"
        class="title-input"
        placeholder="输入标题..."
        @input="onTitleInput"
        @keydown="onTitleKeydown"
      />
    </div>

    <!-- Category & Save Status -->
    <div class="editor-meta-bar">
      <div class="category-select-wrapper">
        <select v-model="localCategoryId" class="category-select" @change="onCategoryChange">
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.icon }} {{ category.name }}
          </option>
        </select>
        <span class="category-icon">{{ getCategoryName(localCategoryId) }}</span>
      </div>

      <div class="save-status" :class="saveStatus">
        <span v-if="saveStatus === 'saved'">已保存</span>
        <span v-else-if="saveStatus === 'saving'">保存中...</span>
        <span v-else>未保存</span>
      </div>
    </div>

    <!-- Rich Text Toolbar -->
    <div class="editor-toolbar">
      <button class="toolbar-btn" @click="toggleBold" title="粗体 (Ctrl+B)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
          <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
        </svg>
      </button>

      <button class="toolbar-btn" @click="toggleItalic" title="斜体 (Ctrl+I)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="19" y1="4" x2="10" y2="4"/>
          <line x1="14" y1="20" x2="5" y2="20"/>
          <line x1="15" y1="4" x2="9" y2="20"/>
        </svg>
      </button>

      <div class="toolbar-divider"></div>

      <div class="color-picker">
        <button class="toolbar-btn color-btn" title="文字颜色">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 3v6M15 3v6M9 9h6M8 21h8M12 9v12"/>
          </svg>
        </button>
        <div class="color-dropdown">
          <button class="color-option" style="color: #fff" @click="setTextColor('#ffffff')">A</button>
          <button class="color-option" style="color: #f87171" @click="setTextColor('#f87171')">A</button>
          <button class="color-option" style="color: #60a5fa" @click="setTextColor('#60a5fa')">A</button>
          <button class="color-option" style="color: #4ade80" @click="setTextColor('#4ade80')">A</button>
          <button class="color-option" style="color: #fbbf24" @click="setTextColor('#fbbf24')">A</button>
          <button class="color-option" style="color: #a78bfa" @click="setTextColor('#a78bfa')">A</button>
        </div>
      </div>

      <div class="toolbar-divider"></div>

      <button class="toolbar-btn" @click="insertCheckbox" title="插入复选框">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </button>

      <button class="toolbar-btn" @click="insertDivider" title="插入分割线">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <button class="toolbar-btn" @click="triggerImageUpload" title="插入图片">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </button>
    </div>

    <!-- Editor Content -->
    <div class="editor-content-wrapper">
      <div
        ref="editorRef"
        class="editor-content"
        contenteditable="true"
        @input="onContentChange"
        @paste="onPaste"
        @keydown="onEditorKeydown"
        spellcheck="false"
      ></div>
    </div>

    <!-- Hidden File Input for Image Upload -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
      style="display: none"
      @change="handleImageSelected"
    />

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteConfirm" class="delete-dialog-overlay" @click="cancelDelete">
      <div class="delete-dialog" @click.stop>
        <div class="delete-dialog-title">🗑️ 删除备忘录</div>
        <div class="delete-dialog-content">确定要删除这条备忘录吗？此操作无法撤销。</div>
        <div class="delete-dialog-actions">
          <button class="dialog-btn cancel-btn" @click="cancelDelete">取消</button>
          <button class="dialog-btn confirm-btn" @click="confirmDelete">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../styles.css";

.memo-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: transparent;
  color: #e8e8ea;
  overflow: hidden;
}

/* Top Bar */
.editor-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.top-bar-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.top-bar-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.top-bar-actions {
  display: flex;
  gap: 8px;
}

.pin-btn.is-pinned {
  background: color-mix(in srgb, var(--focus-color) 20%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 40%, transparent);
  color: var(--focus-color);
}

.delete-btn:hover {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.3);
  color: #f87171;
}

/* Title Area */
.editor-title-area {
  padding: 16px 16px 8px;
  flex-shrink: 0;
}

.title-input {
  width: 100%;
  background: transparent;
  border: none;
  padding: 0;
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  outline: none;
  font-family: inherit;
}

.title-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

/* Meta Bar */
.editor-meta-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  flex-shrink: 0;
}

.category-select-wrapper {
  position: relative;
}

.category-select {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
}

.category-icon {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.category-select-wrapper:hover .category-icon {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
}

.save-status {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  transition: color 0.2s;
}

.save-status.saved {
  color: #4ade80;
}

.save-status.saving {
  color: #60a5fa;
}

.save-status.unsaved {
  color: #fbbf24;
}

/* Toolbar */
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.toolbar-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 4px;
}

/* Color Picker */
.color-picker {
  position: relative;
}

.color-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  display: flex;
  gap: 4px;
  padding: 6px;
  background: rgba(28, 28, 32, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition: all 0.15s;
  z-index: 100;
}

.color-picker:hover .color-dropdown {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.color-option {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
}

.color-option:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

/* Editor Content */
.editor-content-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.editor-content-wrapper::-webkit-scrollbar {
  width: 6px;
}

.editor-content-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.editor-content-wrapper::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}

.editor-content {
  min-height: 100%;
  font-size: 14px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.9);
  outline: none;
}

.editor-content :deep(p) {
  margin: 0 0 12px;
}

.editor-content :deep(br) {
  display: block;
  content: "";
  margin-bottom: 12px;
}

.editor-content :deep(div) {
  margin-bottom: 4px;
}

.editor-content :deep(b),
.editor-content :deep(strong) {
  font-weight: 600;
  color: #fff;
}

.editor-content :deep(i),
.editor-content :deep(em) {
  font-style: italic;
}

.editor-content :deep(u) {
  text-decoration: underline;
  text-decoration-color: rgba(255, 255, 255, 0.4);
}

.editor-content :deep(hr.memo-divider) {
  border: none;
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
  margin: 16px 0;
}

.editor-content :deep(.memo-checkbox-item) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}

.editor-content :deep(.memo-checkbox) {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  background: transparent;
  cursor: pointer;
  appearance: none;
  position: relative;
  flex-shrink: 0;
}

.editor-content :deep(.memo-checkbox:checked) {
  background: var(--focus-color);
  border-color: var(--focus-color);
}

.editor-content :deep(.memo-checkbox:checked::after) {
  content: "";
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 8px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.editor-content :deep(.memo-checkbox-text) {
  color: rgba(255, 255, 255, 0.9);
}

.editor-content :deep(.memo-checkbox:checked + .memo-checkbox-text) {
  text-decoration: line-through;
  color: rgba(255, 255, 255, 0.4);
}

.editor-content :deep(img.memo-image) {
  max-width: 100%;
  border-radius: 8px;
  margin: 8px 0;
  display: block;
}

.editor-content :deep(ul),
.editor-content :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.editor-content :deep(li) {
  margin: 4px 0;
}

.editor-content :deep(blockquote) {
  border-left: 3px solid rgba(255, 255, 255, 0.2);
  margin: 12px 0;
  padding-left: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.editor-content :deep(pre) {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0;
  overflow-x: auto;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
}

.editor-content :deep(code) {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
}

.editor-content :deep(a) {
  color: #60a5fa;
  text-decoration: none;
}

.editor-content :deep(a:hover) {
  text-decoration: underline;
}

/* Delete Confirmation Dialog */
.delete-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.delete-dialog {
  background: rgba(28, 28, 32, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 20px 24px;
  min-width: 280px;
  max-width: 320px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.delete-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 12px;
}

.delete-dialog-content {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
  margin-bottom: 20px;
}

.delete-dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.dialog-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.confirm-btn {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.3);
  color: #f87171;
}

.confirm-btn:hover {
  background: rgba(248, 113, 113, 0.25);
  border-color: rgba(248, 113, 113, 0.5);
}

/* Dark select dropdown styling */
.category-select {
  position: absolute;
  inset: 0;
  cursor: pointer;
  width: 100%;
  opacity: 0;
  /* Ensure dark appearance */
  color-scheme: dark;
  background: rgba(28, 28, 32, 0.98);
}

.category-select option {
  background: rgba(28, 28, 32, 0.98);
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  padding: 8px;
}
</style>
