<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useMemos, CATEGORY_COLORS, getCategoryColor } from '../composables/useMemos'

const emit = defineEmits<{
  close: []
}>()

const { categories, addCategory, updateCategory, deleteCategory } = useMemos()

const editingId = ref<string | null>(null)
const editingName = ref('')
const newCategoryName = ref('')
const newCategoryColor = ref('yellow')
const showAddForm = ref(false)
const addInputRef = ref<HTMLInputElement | null>(null)
const editInputRef = ref<HTMLInputElement | null>(null)

function startEdit(category: { id: string; name: string; isDefault: boolean }) {
  if (category.isDefault) return
  editingId.value = category.id
  editingName.value = category.name
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

function saveEdit() {
  if (!editingId.value) return
  const trimmed = editingName.value.trim()
  if (trimmed) {
    updateCategory(editingId.value, trimmed)
  }
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
}

function handleDelete(id: string) {
  deleteCategory(id)
}

function startAdd() {
  showAddForm.value = true
  newCategoryName.value = ''
  newCategoryColor.value = 'yellow'
  nextTick(() => {
    addInputRef.value?.focus()
  })
}

function saveNewCategory() {
  const trimmed = newCategoryName.value.trim()
  if (trimmed) {
    addCategory(trimmed, newCategoryColor.value)
    showAddForm.value = false
    newCategoryName.value = ''
    newCategoryColor.value = 'yellow'
  }
}

function cancelAdd() {
  showAddForm.value = false
  newCategoryName.value = ''
  newCategoryColor.value = 'yellow'
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <div class="dialog-backdrop" @click="onBackdropClick">
    <div class="dialog-container">
      <div class="dialog-header">
        <span class="dialog-title">管理分类</span>
        <button class="close-btn" @click="emit('close')" title="关闭"><span>✕</span></button>
      </div>

      <div class="dialog-body">
        <div class="category-list">
          <div
            v-for="category in categories"
            :key="category.id"
            class="category-item"
            :class="{ 'is-default': category.isDefault }"
          >
            <span
              class="category-icon"
              :style="{
                backgroundColor: getCategoryColor(category.color).bg,
                borderColor: getCategoryColor(category.color).border,
                color: getCategoryColor(category.color).icon
              }"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </span>

            <template v-if="editingId === category.id">
              <input
                ref="editInputRef"
                v-model="editingName"
                class="edit-input"
                @keydown.enter="saveEdit"
                @keydown.esc="cancelEdit"
                @blur="saveEdit"
              />
            </template>
            <template v-else>
              <span class="category-name">{{ category.name }}</span>
            </template>

            <div class="category-actions">
              <span v-if="category.isDefault" class="default-badge">默认</span>
              <template v-else>
                <button
                  class="action-btn edit-btn"
                  @click="startEdit(category)"
                  title="重命名"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  class="action-btn delete-btn"
                  @click="handleDelete(category.id)"
                  title="删除"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </template>
            </div>
          </div>
        </div>

        <!-- Add Form -->
        <div v-if="showAddForm" class="add-category-form">
          <div class="add-form-row">
            <span
              class="category-icon-preview"
              :style="{ backgroundColor: getCategoryColor(newCategoryColor).icon }"
            />
            <input
              ref="addInputRef"
              v-model="newCategoryName"
              class="edit-input"
              placeholder="输入分类名称"
              @keydown.enter="saveNewCategory"
              @keydown.esc="cancelAdd"
            />
          </div>

          <div class="color-picker-row">
            <span class="color-label">选择颜色：</span>
            <div class="color-options">
              <button
                v-for="color in CATEGORY_COLORS"
                :key="color.id"
                class="color-option-btn"
                :class="{ active: newCategoryColor === color.id }"
                :style="{ borderColor: newCategoryColor === color.id ? color.icon : 'rgba(255,255,255,0.2)' }"
                @click="newCategoryColor = color.id"
                type="button"
              >
                <span class="color-option-dot" :style="{ backgroundColor: color.icon }"></span>
              </button>
            </div>
          </div>

          <div class="add-form-actions">
            <button class="form-btn confirm-btn" @click="saveNewCategory"><span>确认</span></button>
            <button class="form-btn cancel-btn" @click="cancelAdd"><span>取消</span></button>
          </div>
        </div>

        <button v-else class="add-category-btn" @click="startAdd">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>新建分类</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../styles.css";

.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fade-in 0.2s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.dialog-container {
  width: 320px;
  max-height: 80vh;
  background: linear-gradient(180deg, rgba(28, 28, 32, 0.98), rgba(22, 22, 26, 0.97));
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.5),
    0 8px 24px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slide-up 0.25s cubic-bezier(0.2, 0.8, 0.22, 1);
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.close-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.dialog-body {
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dialog-body::-webkit-scrollbar {
  width: 4px;
}

.dialog-body::-webkit-scrollbar-track {
  background: transparent;
}

.dialog-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s;
}

.category-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.category-item.is-default {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.04);
}

.category-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.category-icon svg {
  width: 14px;
  height: 14px;
}

.category-icon-preview {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.category-name {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.default-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
}

.action-btn {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  background: transparent;
  border: 1px solid transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  opacity: 0;
}

.category-item:hover .action-btn {
  opacity: 1;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.edit-btn:hover {
  color: #60a5fa;
}

.delete-btn:hover {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.2);
}

.edit-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  color: #fff;
  outline: none;
  transition: all 0.2s;
}

.edit-input:focus {
  border-color: color-mix(in srgb, var(--focus-color) 60%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus-color) 15%, transparent);
}

.edit-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

/* Add Form */
.add-category-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 4px;
}

.add-form-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-picker-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.color-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}

.color-options {
  display: flex;
  gap: 6px;
}

.color-option-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  padding: 0;
  flex-shrink: 0;
}

.color-option-btn:hover {
  transform: scale(1.1);
  border-color: rgba(255, 255, 255, 0.4);
}

.color-option-btn.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
}

.color-option-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.add-form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

.form-btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.confirm-btn {
  background: color-mix(in srgb, var(--focus-color) 20%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 40%, transparent);
  color: var(--focus-color);
}

.confirm-btn:hover {
  background: color-mix(in srgb, var(--focus-color) 30%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 60%, transparent);
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
  color: #fff;
}

/* Add Button */
.add-category-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  margin-top: 4px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.add-category-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.8);
}
</style>
