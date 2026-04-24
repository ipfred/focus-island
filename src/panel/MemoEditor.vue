<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { readText } from '@tauri-apps/plugin-clipboard-manager'
import type { Memo, MemoCategory } from '../composables/useMemos'
import MemoCategoryDropdown from './MemoCategoryDropdown.vue'

const props = defineProps<{
  memo: Memo
  categories: MemoCategory[]
}>()

const emit = defineEmits<{
  update: [patch: Partial<Pick<Memo, 'title' | 'content' | 'categoryId' | 'isPinned'>>]
  delete: []
  back: [isEmpty: boolean]
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
const showColorPicker = ref(false)
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuRef = ref<HTMLDivElement | null>(null)
const hasSelection = ref(false)

// Track active formatting states
const activeFormats = ref<{ bold: boolean; italic: boolean }>({ bold: false, italic: false })

// Track current font color
const currentColor = ref('#ffffff')

// Available colors
const colors = [
  { value: '#ffffff', label: '白色' },
  { value: '#f87171', label: '红色' },
  { value: '#fbbf24', label: '黄色' },
  { value: '#4ade80', label: '绿色' },
  { value: '#60a5fa', label: '蓝色' },
  { value: '#a78bfa', label: '紫色' },
  { value: '#f472b6', label: '粉色' },
]

// Store last selection to restore after toolbar button clicks
let lastSelectionRange: Range | null = null
const ZERO_WIDTH_SPACE = '\u200B'

function isNodeInEditor(node: Node | null): boolean {
  if (!node || !editorRef.value) return false
  return editorRef.value === node || editorRef.value.contains(node)
}

function getEditorSelectionRange(selection: Selection | null = window.getSelection()): Range | null {
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!isNodeInEditor(range.commonAncestorContainer)) return null
  return range
}

function placeCaretAtEnd(node: Node) {
  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()
  range.selectNodeContents(node)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

function ensureEditorSelection(): Selection | null {
  const selection = window.getSelection()
  if (getEditorSelectionRange(selection)) return selection

  if (!restoreSelection()) {
    editorRef.value?.focus()
    if (editorRef.value) {
      placeCaretAtEnd(editorRef.value)
    }
  }
  return window.getSelection()
}

function normalizeCheckboxText(text: string): string {
  return text.replaceAll(ZERO_WIDTH_SPACE, '').trim()
}

function createCheckboxItem(): HTMLDivElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'memo-checkbox-item'

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.className = 'memo-checkbox'
  checkbox.setAttribute('data-memo-checkbox', 'true')

  const textSpan = document.createElement('span')
  textSpan.className = 'memo-checkbox-text'
  textSpan.textContent = ZERO_WIDTH_SPACE

  wrapper.appendChild(checkbox)
  wrapper.appendChild(textSpan)
  return wrapper
}

// Sync local state when memo changes
watch(() => props.memo, (newMemo) => {
  localTitle.value = newMemo.title
  localContent.value = newMemo.content
  localCategoryId.value = newMemo.categoryId
  localIsPinned.value = newMemo.isPinned
}, { deep: true })

// Auto-save on changes - 10s debounce to reduce flickering
const SAVE_DEBOUNCE_MS = 10000

function scheduleSave() {
  // Don't show 'unsaved' immediately - only show after a delay if user stops typing
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
  }
  // Show 'unsaved' after 2 seconds of inactivity, then save after 10 seconds total
  if (saveStatus.value === 'saved') {
    saveTimeout.value = window.setTimeout(() => {
      saveStatus.value = 'unsaved'
      // Schedule actual save after additional delay
      saveTimeout.value = window.setTimeout(() => {
        doSave()
      }, SAVE_DEBOUNCE_MS - 2000)
    }, 2000)
  } else {
    // Already unsaved, just schedule the save
    saveTimeout.value = window.setTimeout(() => {
      doSave()
    }, SAVE_DEBOUNCE_MS)
  }
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
    if (!restoreSelection() && editorRef.value) {
      placeCaretAtEnd(editorRef.value)
    }
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

// Update active format states based on current selection
function updateActiveFormats() {
  activeFormats.value = {
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
  }

  // Get current font color
  const colorValue = document.queryCommandValue('foreColor')
  if (colorValue) {
    // Convert rgb() to hex if needed
    currentColor.value = rgbToHex(colorValue)
  }
}

// Convert rgb() color to hex
function rgbToHex(rgb: string): string {
  // If already hex, return as-is
  if (rgb.startsWith('#')) return rgb

  // Parse rgb(r, g, b) format
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (match) {
    const r = parseInt(match[1], 10)
    const g = parseInt(match[2], 10)
    const b = parseInt(match[3], 10)
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
  }

  // Try rgba format
  const rgbaMatch = rgb.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10)
    const g = parseInt(rgbaMatch[2], 10)
    const b = parseInt(rgbaMatch[3], 10)
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
  }

  return '#ffffff'
}

// Save current selection for restoring after toolbar clicks
function saveSelection() {
  const selection = window.getSelection()
  const range = getEditorSelectionRange(selection)
  if (range) {
    lastSelectionRange = range.cloneRange()
  }
}

// Restore saved selection
function restoreSelection(): boolean {
  if (!lastSelectionRange || !editorRef.value) return false
  const commonNode = lastSelectionRange.commonAncestorContainer
  if (!document.contains(commonNode) || !isNodeInEditor(commonNode)) {
    lastSelectionRange = null
    return false
  }

  const selection = window.getSelection()
  if (!selection) return false

  try {
    selection.removeAllRanges()
    selection.addRange(lastSelectionRange)
    return true
  } catch {
    lastSelectionRange = null
    return false
  }
}

// Rich text editing commands
function execCommand(command: string, value: string | undefined = undefined) {
  ensureEditorSelection()

  // Execute command
  document.execCommand(command, false, value)

  // Update active states
  updateActiveFormats()

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
  showColorPicker.value = false
}

function insertCheckbox() {
  const selection = ensureEditorSelection()
  const range = getEditorSelectionRange(selection)
  if (!selection || !range) return

  const wrapper = createCheckboxItem()
  const textSpan = wrapper.querySelector('.memo-checkbox-text')
  if (!textSpan) return

  // Insert at cursor position
  range.deleteContents()
  range.insertNode(wrapper)

  // Move cursor inside textSpan
  placeCaretAtEnd(textSpan)
  saveSelection()

  onContentChange()
}

// Handle checkbox clicks via event delegation
function onEditorClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('memo-checkbox')) {
    // Toggle the checked attribute for styling
    const checkbox = target as HTMLInputElement
    if (checkbox.checked) {
      checkbox.setAttribute('checked', '')
    } else {
      checkbox.removeAttribute('checked')
    }

    // Keep focus inside editor to avoid "Enter no response" after clicking checkbox
    const textSpan = checkbox.closest('.memo-checkbox-item')?.querySelector('.memo-checkbox-text')
    if (textSpan) {
      editorRef.value?.focus()
      placeCaretAtEnd(textSpan)
      saveSelection()
    }
    onContentChange()
  }
}

function insertDivider() {
  const selection = ensureEditorSelection()
  const range = getEditorSelectionRange(selection)
  if (!selection || !range) return

  // Create hr element
  const hr = document.createElement('hr')
  hr.className = 'memo-divider'

  // Create line break after
  const br = document.createElement('div')
  br.innerHTML = '<br>'

  // Insert at cursor position
  range.deleteContents()
  range.insertNode(hr)
  hr.after(br)

  // Move cursor to the new empty line
  placeCaretAtEnd(br)
  saveSelection()

  onContentChange()
}

function triggerImageUpload() {
  fileInputRef.value?.click()
}

function handleImageSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // Check file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    alert('仅支持 png, jpg, jpeg, gif, webp 格式的图片')
    input.value = ''
    return
  }

  insertImageFromFile(file)

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

// Handle paste - support text, HTML, and images (screenshots)
async function onPaste(e: ClipboardEvent) {
  e.preventDefault()

  const clipboardData = e.clipboardData
  if (!clipboardData) return

  // Check for images first (screenshots)
  const items = clipboardData.items
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile()
        if (blob) {
          await insertImageFromFile(blob)
          return
        }
      }
    }
  }

  // Fall back to text/HTML paste
  const text = clipboardData.getData('text/plain') || ''
  const html = clipboardData.getData('text/html') || ''

  // If HTML is available and not too complex, use it
  if (html && !html.includes('<script')) {
    document.execCommand('insertHTML', false, html)
  } else {
    document.execCommand('insertText', false, text)
  }
  onContentChange()
}

// Insert image from File/Blob
async function insertImageFromFile(file: File) {
  // Check file size (2MB limit)
  if (file.size > 2 * 1024 * 1024) {
    alert('图片大小不能超过 2MB')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const base64 = e.target?.result as string
    const imgHtml = `<img src="${base64}" class="memo-image" style="max-width: 100%; border-radius: 8px; margin: 8px 0;">`

    editorRef.value?.focus()
    document.execCommand('insertHTML', false, imgHtml)
    onContentChange()
  }
  reader.readAsDataURL(file)
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

// Check if current editor content is empty
function isContentEmpty(): boolean {
  const hasTitle = localTitle.value.trim().length > 0
  const hasContent = localContent.value.replace(/<[^>]+>/g, '').trim().length > 0
  return !hasTitle && !hasContent
}

// Back handler
function handleBack() {
  doSave()
  emit('back', isContentEmpty())
}

// Keyboard shortcuts
function onEditorKeydown(e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229) return

  // Ctrl/Cmd + B for bold
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault()
    toggleBold()
    return
  }
  // Ctrl/Cmd + I for italic
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault()
    toggleItalic()
    return
  }
  // Ctrl/Cmd + S for save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    doSave()
    return
  }

  // Handle Enter in checkbox item - create new checkbox below
  if (e.key === 'Enter' && !e.shiftKey) {
    const selection = window.getSelection()
    const range = getEditorSelectionRange(selection)
    if (!range || !range.collapsed) return

    const node = range.startContainer
    const checkboxText = (node instanceof Element ? node : node.parentElement)?.closest('.memo-checkbox-text')
    const checkboxItem = checkboxText?.closest('.memo-checkbox-item')
    if (!checkboxText || !checkboxItem) return

    e.preventDefault()

    const hasText = normalizeCheckboxText(checkboxText.textContent || '').length > 0
    if (hasText) {
      const newWrapper = createCheckboxItem()
      const newTextSpan = newWrapper.querySelector('.memo-checkbox-text')
      checkboxItem.after(newWrapper)
      if (newTextSpan) {
        placeCaretAtEnd(newTextSpan)
      }
    } else {
      // Mainstream behavior: Enter on empty checkbox exits checklist.
      const nextLine = document.createElement('div')
      nextLine.innerHTML = '<br>'
      checkboxItem.after(nextLine)
      checkboxItem.remove()
      placeCaretAtEnd(nextLine)
    }

    saveSelection()
    onContentChange()
    return
  }

  // Handle Backspace to easily delete checkbox
  if (e.key === 'Backspace') {
    const selection = window.getSelection()
    const range = getEditorSelectionRange(selection)
    if (!selection || !range || !range.collapsed) return

    const node = range.startContainer
    const checkboxText = (node instanceof Element ? node : node.parentElement)?.closest('.memo-checkbox-text')
    const checkboxItem = checkboxText?.closest('.memo-checkbox-item')
    if (!checkboxText || !checkboxItem) return

    const textContent = normalizeCheckboxText(checkboxText.textContent || '')
    const caretAtStart = (() => {
      const startRange = document.createRange()
      startRange.selectNodeContents(checkboxText)
      startRange.collapse(true)
      return range.compareBoundaryPoints(Range.START_TO_START, startRange) === 0
    })()

    // If at start of checkbox text and text is empty, delete the checkbox
    if (caretAtStart && textContent.length === 0) {
      e.preventDefault()

      const newRange = document.createRange()
      newRange.setStartBefore(checkboxItem)
      newRange.collapse(true)

      checkboxItem.remove()

      selection.removeAllRanges()
      selection.addRange(newRange)
      saveSelection()
      onContentChange()
    }
  }
}

// Context menu
function onEditorContextMenu(e: MouseEvent) {
  // Only show custom menu inside the editor
  const target = e.target as HTMLElement
  if (!editorRef.value || !editorRef.value.contains(target)) return

  e.preventDefault()

  const selection = window.getSelection()
  hasSelection.value = !!(selection && selection.toString().trim().length > 0)

  // Position menu, keep within viewport
  const menuWidth = 180
  const menuHeight = 180
  let x = e.clientX
  let y = e.clientY

  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 8
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 8
  }

  contextMenuPosition.value = { x, y }
  showContextMenu.value = true
}

function closeContextMenu() {
  showContextMenu.value = false
}

function onContextMenuAction(action: () => void) {
  action()
  closeContextMenu()
}

function execCopy() {
  document.execCommand('copy', false)
}

async function execPaste() {
  if (!editorRef.value) return

  try {
    const text = await readText()
    if (text) {
      editorRef.value.focus()
      document.execCommand('insertText', false, text)
      onContentChange()
    }
  } catch {
    // 静默失败，不弹窗
  }
}

async function execPasteAsPlainText() {
  if (!editorRef.value) return

  try {
    const text = await readText()
    if (text) {
      editorRef.value.focus()
      document.execCommand('insertText', false, text)
      onContentChange()
    }
  } catch {
    // 静默失败，不弹窗
  }
}

function execSelectAll() {
  if (editorRef.value) {
    const range = document.createRange()
    range.selectNodeContents(editorRef.value)
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }
}

// Close color picker when clicking outside
function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.color-picker')) {
    showColorPicker.value = false
  }
  if (showContextMenu.value && !target.closest('.context-menu')) {
    closeContextMenu()
  }
}

// Handle selection change to update active formats
function onSelectionChange() {
  // Only update if editor is focused
  if (document.activeElement === editorRef.value) {
    updateActiveFormats()
  }
}

// Initialize editor content
onMounted(() => {
  if (editorRef.value) {
    editorRef.value.innerHTML = localContent.value || '<div><br></div>'
  }
  titleInputRef.value?.focus()
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('selectionchange', onSelectionChange)
})

// Cleanup
onBeforeUnmount(() => {
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
  }
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('selectionchange', onSelectionChange)
  // Final save before leaving
  doSave()
})

// Format update time display
function formatUpdateTime(timestamp: number): string {
  const date = new Date(timestamp)
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
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

      <div class="top-bar-spacer"></div>

      <span class="save-time">{{ formatUpdateTime(props.memo.updatedAt) }}</span>

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
      <MemoCategoryDropdown
        v-model="localCategoryId"
        :categories="categories"
        size="medium"
        :showNewButton="false"
        @change="onCategoryChange"
      />
      <input
        ref="titleInputRef"
        v-model="localTitle"
        class="title-input"
        placeholder="输入标题..."
        @input="onTitleInput"
        @keydown="onTitleKeydown"
      />
    </div>

    <!-- Rich Text Toolbar -->
    <div class="editor-toolbar">
      <button
        class="toolbar-btn"
        :class="{ active: activeFormats.bold }"
        @click="toggleBold"
        title="粗体 (Ctrl+B)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
          <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
        </svg>
      </button>

      <button
        class="toolbar-btn"
        :class="{ active: activeFormats.italic }"
        @click="toggleItalic"
        title="斜体 (Ctrl+I)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="19" y1="4" x2="10" y2="4"/>
          <line x1="14" y1="20" x2="5" y2="20"/>
          <line x1="15" y1="4" x2="9" y2="20"/>
        </svg>
      </button>

      <div class="toolbar-divider"></div>

      <div class="color-picker" :class="{ active: showColorPicker }">
        <button
          class="toolbar-btn color-btn"
          title="文字颜色"
          @click="showColorPicker = !showColorPicker"
          :style="{ '--current-color': currentColor }"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 3v6M15 3v6M9 9h6M8 21h8M12 9v12"/>
          </svg>
          <span class="color-indicator" :style="{ backgroundColor: currentColor }"></span>
        </button>
        <div v-show="showColorPicker" class="color-dropdown">
          <button
            v-for="color in colors"
            :key="color.value"
            class="color-option"
            :class="{ active: currentColor === color.value }"
            :style="{ color: color.value }"
            :title="color.label"
            @click.stop="setTextColor(color.value)"
          >
            A
          </button>
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
        @click="onEditorClick"
        @blur="saveSelection"
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

    <!-- Context Menu -->
    <div
      v-if="showContextMenu"
      ref="contextMenuRef"
      class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      @click.stop
    >
      <div class="context-menu-group">
        <button class="context-menu-item" :disabled="!hasSelection" @click="onContextMenuAction(execCopy)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          <span>复制</span>
        </button>
        <button class="context-menu-item" @click="onContextMenuAction(execPaste)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          </svg>
          <span>粘贴</span>
        </button>
        <button class="context-menu-item" @click="onContextMenuAction(execPasteAsPlainText)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span>粘贴为纯文本</span>
        </button>
        <button class="context-menu-item" @click="onContextMenuAction(execSelectAll)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7V4h3M4 17v3h3M20 7V4h-3M20 17v3h-3M9 9h6v6H9z"/>
          </svg>
          <span>全选</span>
        </button>
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
  gap: 8px;
}

.top-bar-spacer {
  flex: 1;
}

.save-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  margin-right: 8px;
  font-variant-numeric: tabular-nums;
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
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px 4px;
  flex-shrink: 0;
}

.title-input {
  flex: 1;
  min-width: 0;
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

.toolbar-btn.active {
  background: color-mix(in srgb, var(--focus-color) 20%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 50%, transparent);
  color: var(--focus-color);
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
  z-index: 100;
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

.color-option.active {
  background: rgba(255, 255, 255, 0.2);
  border-color: currentColor;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
}

.color-picker.active .color-btn {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* Color indicator on toolbar button */
.color-btn {
  position: relative;
}

.color-indicator {
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  width: 14px;
  height: 3px;
  border-radius: 2px;
  transition: background-color 0.2s;
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
  caret-color: #fff;
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
  min-height: 24px;
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
  flex: 1;
  min-width: 1px;
  outline: none;
}

.editor-content :deep(.memo-checkbox-text:empty::before) {
  content: '\200B';
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

/* Context Menu */
.context-menu {
  position: fixed;
  z-index: 2000;
  min-width: 180px;
  max-width: 240px;
  background: rgba(28, 28, 32, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 6px 0;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(16px);
  font-size: 13px;
  user-select: none;
  animation: contextMenuIn 0.12s ease-out;
}

@keyframes contextMenuIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.context-menu-group {
  display: flex;
  flex-direction: column;
  padding: 0 6px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  font-family: inherit;
}

.context-menu-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.context-menu-item:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}

.context-menu-item:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.context-menu-item.active {
  color: var(--focus-color);
}

.context-menu-item svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.context-menu-item span {
  flex: 1;
  min-width: 0;
}

.context-menu-shortcut {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  font-family: 'SF Mono', Monaco, monospace;
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  white-space: nowrap;
}

.context-menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 6px 8px;
}
</style>
