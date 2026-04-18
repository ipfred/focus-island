<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title?: string
  iconPaths?: string[]
}>()
defineEmits<{ close: [] }>()

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
      <span class="titlebar-title">{{ title || '任务清单' }}</span>
    </div>
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

.titlebar-actions {
  display: flex;
  gap: 6px;
}

button {
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
