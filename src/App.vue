<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Island from './components/Island.vue'
import PanelApp from './panel/PanelApp.vue'

const windowLabel = ref<string>('main')

onMounted(async () => {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    windowLabel.value = getCurrentWebviewWindow().label
  } catch {
    windowLabel.value = 'main'
  }
})
</script>

<template>
  <Island v-if="windowLabel === 'main'" />
  <PanelApp v-else-if="windowLabel === 'panel'" />
</template>
