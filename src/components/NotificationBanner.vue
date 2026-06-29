<script setup lang="ts">
import { computed } from 'vue'
import type { NotificationType } from '../composables/useTimer'

const props = defineProps<{
  type: NotificationType
  scale: number
}>()

const emit = defineEmits<{
  confirm: []
  extend: []
  dismiss: []
}>()

const isFocusDone = computed(() => props.type === 'focus-done')

// Primary color guides the recommended next step:
// - focus-done → recommend break (green)
// - break-done → recommend focus (orange)
const primaryColor = computed(() => isFocusDone.value ? '#3a9e6e' : '#e85d3a')

const extendColor = computed(() => isFocusDone.value ? '#e85d3a' : '#3a9e6e')
</script>

<template>
  <transition name="notif">
    <div
      v-if="type"
      class="notif-banner"
      :style="{
        '--notif-scale': scale,
        '--accent': primaryColor,
        '--extend-color': extendColor,
      }"
    >
      <div class="notif-icon">{{ isFocusDone ? '✅' : '⏰' }}</div>
      <div class="notif-text">
        <div class="notif-title">{{ isFocusDone ? '完成了一个番茄' : '休息结束' }}</div>
        <div class="notif-sub">{{ isFocusDone ? '休息一下吧' : '准备开启下一个番茄钟吗' }}</div>
      </div>
      <div class="notif-actions">
        <button class="notif-btn primary" @click="emit('confirm')">
          {{ isFocusDone ? '休息' : '专注' }}
        </button>
        <button class="notif-btn extend" @click="emit('extend')">
          {{ isFocusDone ? '专注' : '休息' }}
        </button>
        <button class="notif-btn dismiss" @click="emit('dismiss')">退出</button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
@reference "../styles.css";

.notif-banner {
  width: calc(352px * var(--notif-scale, 1));
  height: calc(60px * var(--notif-scale, 1));
  border-radius: calc(24px * var(--notif-scale, 1));
  background: var(--notif-bg);
  border: 1px solid var(--notif-border);
  box-shadow: var(--notif-shadow);
  display: flex;
  align-items: center;
  gap: calc(8px * var(--notif-scale, 1));
  padding: 0 calc(12px * var(--notif-scale, 1));
  pointer-events: auto;
  contain: layout style paint;
}

.notif-icon {
  width: calc(36px * var(--notif-scale, 1));
  height: calc(36px * var(--notif-scale, 1));
  border-radius: 50%;
  background: var(--notif-icon-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(18px * var(--notif-scale, 1));
  flex-shrink: 0;
}

.notif-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: calc(2px * var(--notif-scale, 1));
}

.notif-title {
  font-size: calc(12px * var(--notif-scale, 1));
  font-weight: 700;
  color: var(--notif-title-color);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-sub {
  font-size: calc(10px * var(--notif-scale, 1));
  color: var(--notif-sub-color);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-actions {
  display: flex;
  gap: calc(5px * var(--notif-scale, 1));
  flex-shrink: 0;
}

.notif-btn {
  height: calc(28px * var(--notif-scale, 1));
  padding: 0 calc(10px * var(--notif-scale, 1));
  border-radius: calc(8px * var(--notif-scale, 1));
  font-size: calc(11px * var(--notif-scale, 1));
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
  font-family: inherit;
}

.notif-btn.primary {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: #fff;
}

.notif-btn.primary:hover {
  filter: brightness(1.15);
}

.notif-btn.extend {
  background: transparent;
  border: 1px solid var(--extend-color);
  color: var(--extend-color);
}

.notif-btn.extend:hover {
  background: color-mix(in srgb, var(--extend-color) 15%, transparent);
  color: var(--notif-title-color);
}

.notif-btn.dismiss {
  background: transparent;
  border: 1px solid var(--notif-dismiss-border);
  color: var(--notif-dismiss-color);
}

.notif-btn.dismiss:hover {
  background: var(--notif-dismiss-hover-bg);
  border-color: var(--notif-dismiss-hover-border);
  color: var(--notif-dismiss-hover-color);
}

/* Transition animation */
.notif-enter-active {
  animation: notif-in 300ms ease-out both;
}

.notif-leave-active {
  animation: notif-out 200ms ease-in both;
}

@keyframes notif-in {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes notif-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}
</style>
