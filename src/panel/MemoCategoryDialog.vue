<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useMemos } from '../composables/useMemos'

const emit = defineEmits<{
  close: []
}>()

const { categories, addCategory, updateCategory, deleteCategory } = useMemos()

const editingId = ref<string | null>(null)
const editingName = ref('')
const newCategoryName = ref('')
const showAddInput = ref(false)
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
  showAddInput.value = true
  newCategoryName.value = ''
  nextTick(() => {
    addInputRef.value?.focus()
  })
}

function saveNewCategory() {
  const trimmed = newCategoryName.value.trim()
  if (trimmed) {
    addCategory(trimmed)
  }
  showAddInput.value = false
  newCategoryName.value = ''
}

function cancelAdd() {
  showAddInput.value = false
  newCategoryName.value = ''
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
        <button class="close-btn" @click="emit('close')" title="关闭">✕</button>
      </div>

      <div class="dialog-body">
        <div class="category-list">
          <div
            v-for="category in categories"
            :key="category.id"
            class="category-item"
            :class="{ 'is-default': category.isDefault }"
          >
            <span class="category-icon">{{ category.icon }}</span>

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
                  ✎
                </button>
                <button
                  class="action-btn delete-btn"
                  @click="handleDelete(category.id)"
                  title="删除"
                >
                  ✕
                </button>
              </template>
            </div>
          </div>
        </div>

        <div v-if="showAddInput" class="add-category-row">
          <span class="category-icon">📝</span>
          <input
            ref="addInputRef"
            v-model="newCategoryName"
            class="edit-input"
            placeholder="输入分类名称"
            @keydown.enter="saveNewCategory"
            @keydown.esc="cancelAdd"
            @blur="saveNewCategory"
          />
          <div class="category-actions">
            <button class="action-btn confirm-btn" @click="saveNewCategory" title="确认">
              ✓
            </button>
            <button class="action-btn cancel-btn" @click="cancelAdd" title="取消">
              ✕
            </button>
          </div>
        </div>

        <button v-else class="add-category-btn" @click="startAdd">
          <span class="add-icon">+</span>
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
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.dialog-container {
  width: 360px;
  max-height: 70vh;
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
  width: 24px;
  height: 24px;
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
  font-size: 16px;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
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

.confirm-btn {
  opacity: 1;
  color: #4ade80;
}

.confirm-btn:hover {
  background: rgba(74, 222, 128, 0.15);
  border-color: rgba(74, 222, 128, 0.3);
}

.cancel-btn {
  opacity: 1;
  color: rgba(255, 255, 255, 0.5);
}

.cancel-btn:hover {
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

.add-category-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 4px;
}

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

.add-icon {
  font-size: 16px;
  font-weight: 300;
}
</style>
