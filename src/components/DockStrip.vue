<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  progress: number
  color: string
  scale: number
}>()

const fillWidth = computed(() => `${Math.max(0, Math.min(1, props.progress)) * 100}%`)
const barHeight = computed(() => `${Math.max(2, 4 * props.scale)}px`)
</script>

<template>
  <div class="dock-strip">
    <div class="track" :style="{ height: barHeight }">
      <div class="fill" :style="{ width: fillWidth, height: barHeight, background: color }" />
    </div>
  </div>
</template>

<style scoped>
.dock-strip {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.track {
  width: 80%;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
  display: flex;
  align-items: stretch;
}

.fill {
  border-radius: 999px;
  transition: width 0.4s linear, background 0.3s ease;
  min-width: 0;
}
</style>
