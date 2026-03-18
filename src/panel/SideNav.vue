<script setup lang="ts">
import type { TaskCategory } from '../composables/useTasks'

defineProps<{ selected: TaskCategory }>()
const emit = defineEmits<{ select: [cat: TaskCategory] }>()

const items: { label: string; value: TaskCategory; icon: string }[] = [
  { label: '今天', value: 'today', icon: '☀' },
  { label: '明天', value: 'tomorrow', icon: '📅' },
  { label: '本周', value: 'week', icon: '📆' },
]
</script>

<template>
  <nav class="sidenav">
    <div class="sidenav-logo">
      <span class="logo-dot" />
      <span class="logo-text">番茄岛</span>
    </div>
    <ul class="sidenav-list">
      <li
        v-for="item in items"
        :key="item.value"
        class="sidenav-item"
        :class="{ active: selected === item.value }"
        @click="emit('select', item.value)"
      >
        <span class="sidenav-icon">{{ item.icon }}</span>
        <span class="sidenav-label">{{ item.label }}</span>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.sidenav {
  width: 160px;
  flex-shrink: 0;
  background: rgba(10, 10, 14, 0.7);
  border-right: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  padding-top: 12px;
}

.sidenav-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px 20px;
}

.logo-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--focus-color, #e85d3a);
  display: inline-block;
  flex-shrink: 0;
}

.logo-text {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255,255,255,0.85);
  letter-spacing: 0.04em;
}

.sidenav-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sidenav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  border-radius: 8px;
  margin: 2px 8px;
  cursor: pointer;
  color: rgba(255,255,255,0.5);
  font-size: 13px;
  transition: background 0.15s, color 0.15s;
}

.sidenav-item:hover {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.85);
}

.sidenav-item.active {
  background: rgba(232,93,58,0.18);
  color: #e85d3a;
  font-weight: 600;
}

.sidenav-icon {
  font-size: 15px;
  flex-shrink: 0;
}
</style>
