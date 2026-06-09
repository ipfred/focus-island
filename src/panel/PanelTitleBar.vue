<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title?: string
  iconPaths?: string[]
  searchQuery?: string
  searchPlaceholder?: string
  showSearch?: boolean
}>()

const emit = defineEmits<{
  close: []
  'update:searchQuery': [value: string]
}>()

const fallbackIconPaths = ['M4 6h2', 'M4 12h2', 'M4 18h2', 'M9 6h11', 'M9 12h11', 'M9 18h11']
const displayIconPaths = computed(() => props.iconPaths?.length ? props.iconPaths : fallbackIconPaths)
</script>

<template>
  <div class="titlebar">
    <div class="titlebar-main">
      <span class="titlebar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <path
            v-for="(path, index) in displayIconPaths"
            :key="`title-icon-${index}`"
            :d="path"
          />
        </svg>
      </span>
      <span class="titlebar-title">{{ title || 'TODO' }}</span>
    </div>

    <div v-if="showSearch" class="titlebar-search">
      <svg class="search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="7"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        :value="searchQuery"
        type="text"
        class="search-input"
        :placeholder="searchPlaceholder || '搜索当前分类...'"
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      />
      <button
        v-if="searchQuery"
        class="search-clear"
        type="button"
        aria-label="清除搜索"
        @click="emit('update:searchQuery', '')"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div v-else class="titlebar-spacer"></div>

    <div class="titlebar-actions">
      <button class="btn-close" @click="$emit('close')" title="关闭">✕</button>
    </div>
  </div>
</template>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  height: 40px;
  padding: 0 12px 0 16px;
  background: rgba(12, 12, 16, 0.98);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  flex-shrink: 0;
}

.titlebar-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-shrink: 0;
}

.titlebar-icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.72);
  flex-shrink: 0;
}

.titlebar-icon svg {
  width: 100%;
  height: 100%;
  stroke-width: 1.8;
}

.titlebar-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.75);
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.titlebar-spacer {
  flex: 1;
}

.titlebar-search {
  flex: 0 1 260px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 26px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  transition: all 0.2s;
}

.titlebar-search:focus-within {
  background: rgba(255, 255, 255, 0.08);
  border-color: color-mix(in srgb, var(--focus-color) 55%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus-color) 14%, transparent);
}

.search-icon {
  color: rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

.titlebar-search:focus-within .search-icon {
  color: color-mix(in srgb, var(--focus-color) 80%, transparent);
}

.search-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  font-family: inherit;
  padding: 0;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.search-clear {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.15s;
}

.search-clear:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.titlebar-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.titlebar-actions button {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.45);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.btn-close:hover {
  background: rgba(220, 60, 60, 0.75);
  color: #fff;
}
</style>
