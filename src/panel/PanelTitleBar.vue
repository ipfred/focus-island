<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

defineEmits<{ close: [] }>()

const win = getCurrentWebviewWindow()
</script>

<template>
  <div class="titlebar">
    <span class="titlebar-title">专注清单</span>
    <div class="titlebar-actions">
      <button class="btn-minimize" @click="win.minimize()" title="最小化">−</button>
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

.titlebar-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.75);
  letter-spacing: 0.02em;
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

.btn-minimize:hover {
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.9);
}

.btn-close:hover {
  background: rgba(220, 60, 60, 0.75);
  color: #fff;
}
</style>
