<script setup lang="ts">
import { ref } from 'vue'
import { useMemos, type Memo } from '../composables/useMemos'
import MemoEditor from './MemoEditor.vue'
import MemoCategoryDialog from './MemoCategoryDialog.vue'
import MemoCategoryDropdown from './MemoCategoryDropdown.vue'
import MemoCategoryTag from './MemoCategoryTag.vue'

const emit = defineEmits<{
  back: []
}>()

const { categories, currentCategoryId, filteredMemos, memoCount, addMemo, updateMemo, deleteMemo, togglePin, getDisplayTitle } = useMemos()

// View state
const view = ref<'list' | 'edit'>('list')
const editingMemo = ref<Memo | null>(null)
const showCategoryDialog = ref(false)

// Format time display
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  // Today
  if (dateStart.getTime() === today.getTime()) {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `今天 ${hours}:${minutes}`
  }

  // Yesterday
  if (dateStart.getTime() === yesterday.getTime()) {
    return '昨天'
  }

  // This week (within 7 days)
  const weekAgo = today.getTime() - 7 * 24 * 60 * 60 * 1000
  if (dateStart.getTime() > weekAgo) {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    return `星期${weekdays[date.getDay()]}`
  }

  // Other dates
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${month}-${day}`
}

// Extract plain text preview from HTML content
function getContentPreview(content: string, maxLength: number = 40): string {
  const plainText = content.replace(/<[^>]+>/g, '').trim()
  if (plainText.length === 0) return '无内容'
  if (plainText.length <= maxLength) return plainText
  return plainText.slice(0, maxLength) + '...'
}

// Create new memo
function handleNewMemo() {
  const memo = addMemo(currentCategoryId.value)
  editingMemo.value = memo
  view.value = 'edit'
}

// Edit existing memo
function handleEditMemo(memo: Memo) {
  editingMemo.value = memo
  view.value = 'edit'
}

// Handle memo update from editor
function handleMemoUpdate(patch: Partial<Pick<Memo, 'title' | 'content' | 'categoryId' | 'isPinned'>>) {
  if (editingMemo.value) {
    updateMemo(editingMemo.value.id, patch)
  }
}

// Handle memo delete from editor
function handleMemoDelete() {
  if (editingMemo.value) {
    deleteMemo(editingMemo.value.id)
    view.value = 'list'
    editingMemo.value = null
  }
}

// Back to list from editor
function handleBackToList() {
  view.value = 'list'
  editingMemo.value = null
}

// Toggle pin status
function handleTogglePin(memo: Memo, event: Event) {
  event.stopPropagation()
  togglePin(memo.id)
}

// Delete memo - show confirmation dialog
const showDeleteConfirm = ref(false)
const pendingDeleteMemoId = ref<string | null>(null)

function handleDeleteMemo(memo: Memo, event: Event) {
  event.stopPropagation()
  pendingDeleteMemoId.value = memo.id
  showDeleteConfirm.value = true
}

function confirmDeleteMemo() {
  if (pendingDeleteMemoId.value) {
    deleteMemo(pendingDeleteMemoId.value)
  }
  showDeleteConfirm.value = false
  pendingDeleteMemoId.value = null
}

function cancelDeleteMemo() {
  showDeleteConfirm.value = false
  pendingDeleteMemoId.value = null
}

// Open category dialog
function handleManageCategories() {
  showCategoryDialog.value = true
}

// Close category dialog
function handleCloseCategoryDialog() {
  showCategoryDialog.value = false
}
</script>

<template>
  <div class="memo-page">
    <!-- List View -->
    <template v-if="view === 'list'">
      <!-- Header: 返回 + 功能按钮 -->
      <div class="memo-header">
        <button class="back-btn" @click="emit('back')">←</button>
        <div class="header-actions">
          <!-- 分类选择 -->
          <MemoCategoryDropdown
            v-model="currentCategoryId"
            :categories="categories"
            size="small"
            @new-category="handleManageCategories"
          />
          <!-- 条数显示 -->
          <span class="memo-count-badge">{{ memoCount }} 条</span>
          <!-- 分类设置 -->
          <button class="header-icon-btn" @click="handleManageCategories" title="管理分类">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l-.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <!-- 新建 -->
          <button class="header-new-btn" @click="handleNewMemo" title="新建备忘录">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>新建</span>
          </button>
        </div>
      </div>

      <!-- Memo List -->
      <div class="memo-list">
        <div
          v-for="memo in filteredMemos"
          :key="memo.id"
          class="memo-item"
          :class="{ 'is-pinned': memo.isPinned }"
          @click="handleEditMemo(memo)"
        >
          <div class="memo-item-header">
            <span class="memo-item-title">{{ getDisplayTitle(memo) }}</span>
            <div class="memo-item-actions">
              <button
                class="action-btn pin-btn"
                :class="{ 'is-pinned': memo.isPinned }"
                @click="(e) => handleTogglePin(memo, e)"
                :title="memo.isPinned ? '取消置顶' : '置顶'"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </button>
              <button
                class="action-btn delete-btn"
                @click="(e) => handleDeleteMemo(memo, e)"
                title="删除"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="memo-item-meta">
            <MemoCategoryTag :category-id="memo.categoryId" />
            <span class="memo-item-time">{{ formatTime(memo.updatedAt) }}</span>
          </div>
          <div class="memo-item-preview">{{ getContentPreview(memo.content) }}</div>
        </div>

        <!-- Empty State -->
        <div v-if="filteredMemos.length === 0" class="memo-empty-state">
          <div class="empty-icon">📝</div>
          <div class="empty-text">还没有备忘录</div>
          <button class="empty-action-btn" @click="handleNewMemo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            新建一条
          </button>
        </div>
      </div>

    </template>

    <!-- Edit View -->
    <template v-else-if="view === 'edit' && editingMemo">
      <MemoEditor
        :memo="editingMemo"
        :categories="categories.filter(c => !c.isDefault || c.id !== 'all')"
        @update="handleMemoUpdate"
        @delete="handleMemoDelete"
        @back="handleBackToList"
      />
    </template>

    <!-- Delete Confirmation Dialog -->
    <div v-if="showDeleteConfirm" class="delete-dialog-overlay" @click="cancelDeleteMemo">
      <div class="delete-dialog" @click.stop>
        <div class="delete-dialog-title">🗑️ 删除备忘录</div>
        <div class="delete-dialog-content">确定要删除这条备忘录吗？此操作无法撤销。</div>
        <div class="delete-dialog-actions">
          <button class="dialog-btn cancel-btn" @click="cancelDeleteMemo">取消</button>
          <button class="dialog-btn confirm-btn" @click="confirmDeleteMemo">删除</button>
        </div>
      </div>
    </div>

    <!-- Category Dialog -->
    <MemoCategoryDialog
      v-if="showCategoryDialog"
      @close="handleCloseCategoryDialog"
    />
  </div>
</template>

<style scoped>
@reference "../styles.css";

.memo-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: transparent;
  color: #e8e8ea;
  overflow: hidden;
}
/* Header - 返回 + 功能按钮 */
.memo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  gap: 12px;
}

.back-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: flex-end;
}

.memo-count-badge {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
  white-space: nowrap;
}

.header-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.header-icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.header-new-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  height: 28px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--focus-color) 30%, transparent);
  color: var(--focus-color);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.header-new-btn:hover {
  background: color-mix(in srgb, var(--focus-color) 25%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 50%, transparent);
}

.header-new-btn span {
  line-height: 1;
}

/* Memo List */
.memo-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.memo-list::-webkit-scrollbar {
  width: 6px;
}

.memo-list::-webkit-scrollbar-track {
  background: transparent;
}

.memo-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}

.memo-item {
  padding: 12px 14px;
  margin-bottom: 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.2s;
}

.memo-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-1px);
}

.memo-item.is-pinned {
  background: color-mix(in srgb, var(--focus-color) 8%, rgba(255, 255, 255, 0.04));
  border-color: color-mix(in srgb, var(--focus-color) 25%, rgba(255, 255, 255, 0.1));
}

.memo-item.is-pinned:hover {
  background: color-mix(in srgb, var(--focus-color) 12%, rgba(255, 255, 255, 0.08));
  border-color: color-mix(in srgb, var(--focus-color) 35%, rgba(255, 255, 255, 0.15));
}

.memo-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.memo-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.memo-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.memo-item:hover .memo-item-actions,
.memo-item.is-pinned .memo-item-actions {
  opacity: 1;
}

.action-btn {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  background: transparent;
  border: 1px solid transparent;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.7);
}

/* Pin button: highlighted when pinned */
.pin-btn.is-pinned {
  color: var(--focus-color);
}

.pin-btn.is-pinned:hover {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.25);
  color: #f87171;
}

.delete-btn:hover {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.25);
  color: #f87171;
}

.memo-item-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.memo-item-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}

.memo-item-preview {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Empty State */
.memo-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.6;
}

.empty-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 16px;
}

.empty-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--focus-color) 30%, transparent);
  color: var(--focus-color);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.empty-action-btn:hover {
  background: color-mix(in srgb, var(--focus-color) 25%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 50%, transparent);
  transform: scale(1.02);
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
</style>
