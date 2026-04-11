<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { getCategoryColor, type MemoCategory } from '../composables/useMemos'

const props = defineProps<{
  categories: MemoCategory[]
  modelValue: string
  placeholder?: string
  size?: 'small' | 'medium' | 'large'
  showNewButton?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
  'new-category': []
}>()

// State
const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownPosition = ref<'bottom' | 'top'>('bottom')

// Computed
const currentCategory = computed(() => {
  return props.categories.find(c => c.id === props.modelValue)
})

const displayCategories = computed(() => {
  return props.categories.filter(c => c.id !== 'all')
})

const sizeClass = computed(() => {
  return props.size || 'medium'
})

// Cached trigger styles
const triggerColorStyle = computed(() => {
  if (!currentCategory.value) return {}
  const color = getCategoryColor(currentCategory.value.color)
  return {
    backgroundColor: color.bg,
    borderColor: color.border
  }
})

const triggerIconColor = computed(() => {
  if (!currentCategory.value) return ''
  return getCategoryColor(currentCategory.value.color).icon
})

// Helper for category item styles
function getCategoryIconStyle(colorId: string) {
  const color = getCategoryColor(colorId)
  return {
    backgroundColor: color.bg,
    borderColor: color.border
  }
}

function getCategoryIconColor(colorId: string) {
  return getCategoryColor(colorId).icon
}

// Methods
function toggle() {
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

function open() {
  isOpen.value = true
  nextTick(() => {
    calculatePosition()
  })
}

function close() {
  isOpen.value = false
}

function selectCategory(categoryId: string) {
  if (categoryId !== props.modelValue) {
    emit('update:modelValue', categoryId)
    emit('change', categoryId)
  }
  close()
}

function handleNewCategory() {
  emit('new-category')
  close()
}

function calculatePosition() {
  if (!triggerRef.value || !dropdownRef.value) return

  const triggerRect = triggerRef.value.getBoundingClientRect()
  const dropdownHeight = dropdownRef.value.offsetHeight
  const viewportHeight = window.innerHeight

  const spaceBelow = viewportHeight - triggerRect.bottom
  if (spaceBelow < dropdownHeight + 10 && triggerRect.top > dropdownHeight + 10) {
    dropdownPosition.value = 'top'
  } else {
    dropdownPosition.value = 'bottom'
  }
}

function onClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!dropdownRef.value?.contains(target) && !triggerRef.value?.contains(target)) {
    close()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="memo-category-dropdown" :class="[sizeClass]">
    <!-- Trigger Button -->
    <button
      ref="triggerRef"
      class="dropdown-trigger"
      :class="{ 'is-open': isOpen }"
      @click="toggle"
      type="button"
    >
      <span class="trigger-content">
        <span v-if="currentCategory" class="trigger-icon-wrapper">
          <span
            class="folder-icon-container"
            :style="triggerColorStyle"
          >
            <svg
              class="trigger-folder-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              :style="{ color: triggerIconColor }"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
        </span>
        <span class="trigger-text">
          {{ currentCategory?.name || placeholder || '选择分类' }}
        </span>
      </span>
      <svg
        class="trigger-arrow"
        :class="{ 'is-open': isOpen }"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </button>

    <!-- Dropdown Menu -->
    <Transition name="dropdown">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="dropdown-menu"
        :class="{ 'position-top': dropdownPosition === 'top' }"
      >
        <div class="dropdown-list">
          <button
            v-for="category in displayCategories"
            :key="category.id"
            class="dropdown-item"
            :class="{ 'is-active': modelValue === category.id }"
            @click="selectCategory(category.id)"
            type="button"
          >
            <span
              class="item-icon-wrapper"
              :style="getCategoryIconStyle(category.color)"
            >
              <svg
                class="item-folder-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                :style="{ color: getCategoryIconColor(category.color) }"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </span>
            <span class="item-name">{{ category.name }}</span>
            <svg
              v-if="modelValue === category.id"
              class="item-check"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </button>
        </div>

        <div v-if="showNewButton !== false" class="dropdown-footer">
          <button
            class="new-category-btn"
            @click="handleNewCategory"
            type="button"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>新建分类</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
@reference "../styles.css";

.memo-category-dropdown {
  position: relative;
  display: inline-flex;
}

/* Size variants - more compact */
.memo-category-dropdown.small .dropdown-trigger {
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
}

.memo-category-dropdown.small .folder-icon-container {
  width: 18px;
  height: 18px;
}

.memo-category-dropdown.small .trigger-folder-icon {
  width: 12px;
  height: 12px;
}

.memo-category-dropdown.medium .dropdown-trigger {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}

.memo-category-dropdown.medium .folder-icon-container {
  width: 20px;
  height: 20px;
}

.memo-category-dropdown.medium .trigger-folder-icon {
  width: 13px;
  height: 13px;
}

.memo-category-dropdown.large .dropdown-trigger {
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
}

.memo-category-dropdown.large .folder-icon-container {
  width: 22px;
  height: 22px;
}

.memo-category-dropdown.large .trigger-folder-icon {
  width: 14px;
  height: 14px;
}

/* Trigger Button */
.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.dropdown-trigger:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}

.dropdown-trigger.is-open {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
}

.trigger-content {
  display: flex;
  align-items: center;
  gap: 5px;
}

.trigger-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.folder-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border: 1px solid;
}

.trigger-folder-icon {
  flex-shrink: 0;
}

.trigger-text {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.trigger-arrow {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.4);
  transition: transform 0.2s ease;
}

.trigger-arrow.is-open {
  transform: rotate(180deg);
  color: rgba(255, 255, 255, 0.6);
}

/* Dropdown Menu - more compact */
.dropdown-menu {
  position: absolute;
  left: 0;
  top: calc(100% + 4px);
  min-width: 160px;
  max-width: 200px;
  background: linear-gradient(180deg, rgba(32, 32, 38, 0.98), rgba(26, 26, 30, 0.97));
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.5),
    0 8px 20px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  overflow: hidden;
}

.dropdown-menu.position-top {
  top: auto;
  bottom: calc(100% + 4px);
}

.dropdown-list {
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
}

.dropdown-list::-webkit-scrollbar {
  width: 3px;
}

.dropdown-list::-webkit-scrollbar-track {
  background: transparent;
}

.dropdown-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

/* Dropdown Item - more compact */
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.dropdown-item.is-active {
  background: rgba(255, 255, 255, 0.08);
}

.item-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid;
  flex-shrink: 0;
}

.item-folder-icon {
  width: 13px;
  height: 13px;
}

.item-name {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-item.is-active .item-name {
  color: #fff;
}

.item-check {
  flex-shrink: 0;
  color: #4ade80;
}

/* Dropdown Footer */
.dropdown-footer {
  padding: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.new-category-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  padding: 8px;
  border-radius: 6px;
  background: transparent;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  color: var(--focus-color);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.new-category-btn:hover {
  background: color-mix(in srgb, var(--focus-color) 8%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 35%, transparent);
}

/* Animations */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.18s cubic-bezier(0.2, 0.8, 0.22, 1);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.dropdown-enter-to,
.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
