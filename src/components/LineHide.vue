<script setup lang="ts">
import { computed } from 'vue'
import { useTimer } from '../composables/useTimer'

const { progress, phase } = useTimer()

const lineColor = computed(() => {
  if (phase.value === 'focus') return 'var(--focus-color)'
  if (phase.value === 'break') return 'var(--break-color)'
  return 'var(--idle-color)'
})

const lineWidth = computed(() => `${Math.max(8, progress.value * 100)}%`)
</script>

<template>
  <!-- The 2px collapsed line shown when hiding -->
  <div class="w-full h-full flex items-start justify-center">
    <div
      class="h-[2px] rounded-full transition-all duration-1000 ease-linear opacity-70"
      :style="{ width: lineWidth, backgroundColor: lineColor }"
    />
  </div>
</template>
