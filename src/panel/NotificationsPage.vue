<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useNotifications, formatNotifTime } from '../composables/useNotifications'

defineEmits<{ back: [] }>()

const { records, unreadCount, markAllRead, clearAll } = useNotifications()

// ---- 快捷设置：系统音量 ----

const sysVolume = ref(0)
const sysMuted = ref(false)
const volumeReady = ref(false)
const volumeError = ref<string | null>(null)
let applying = false

async function refreshVolume() {
  try {
    const state = await invoke<{ volume: number; muted: boolean }>('get_volume_state')
    sysVolume.value = Math.round(state.volume * 100)
    sysMuted.value = state.muted
    volumeReady.value = true
    volumeError.value = null
  } catch (e) {
    volumeError.value = typeof e === 'string' ? e : '无法读取系统音量'
  }
}

async function onVolumeInput(event: Event) {
  const v = Number((event.target as HTMLInputElement).value)
  sysVolume.value = v
  if (applying) return
  applying = true
  try {
    if (sysMuted.value && v > 0) {
      sysMuted.value = false
      await invoke('set_system_mute', { muted: false })
    }
    await invoke('set_system_volume', { volume: v / 100 })
  } catch {
    /* 滑动中失败不打断 */
  } finally {
    applying = false
  }
}

async function toggleMute() {
  const next = !sysMuted.value
  sysMuted.value = next
  try {
    await invoke('set_system_mute', { muted: next })
  } catch {
    sysMuted.value = !next
  }
}

onMounted(refreshVolume)
</script>

<template>
  <div class="notif-page">
    <div class="page-topbar">
      <button class="back-btn" @click="$emit('back')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <span class="page-title">通知中心</span>
      <button v-if="records.length" class="text-btn" @click="clearAll">清空</button>
      <span v-else class="text-btn placeholder"> </span>
    </div>

    <!-- 快捷设置 -->
    <div class="section">
      <div class="section-title">快捷设置</div>
      <div v-if="volumeReady" class="volume-row">
        <button class="mute-btn" :class="{ active: sysMuted }" @click="toggleMute" :title="sysMuted ? '取消静音' : '静音'">
          <svg v-if="sysMuted || sysVolume === 0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        </button>
        <input
          type="range"
          class="volume-slider"
          min="0"
          max="100"
          :value="sysVolume"
          @input="onVolumeInput"
        />
        <span class="volume-value">{{ sysMuted ? '静音' : sysVolume }}</span>
      </div>
      <div v-else class="volume-hint">{{ volumeError ?? '读取系统音量中…' }}</div>
    </div>

    <!-- 通知记录 -->
    <div class="section-head">
      <span class="section-title">通知记录</span>
      <button v-if="unreadCount" class="text-btn" @click="markAllRead">全部已读 ({{ unreadCount }})</button>
    </div>
    <div v-if="records.length" class="notif-list">
      <div v-for="r in records" :key="r.id" class="notif-item" :class="{ unread: !r.read }">
        <div class="notif-dot" />
        <div class="notif-body">
          <div class="notif-line">
            <span class="notif-title">{{ r.title }}</span>
            <span class="notif-time">{{ formatNotifTime(r.time) }}</span>
          </div>
          <div class="notif-detail">{{ r.detail }}</div>
        </div>
      </div>
    </div>
    <div v-else class="empty">还没有通知，完成一个番茄后会记录在这里</div>
  </div>
</template>

<style scoped>
@reference "../styles.css";

.notif-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 0 12px 12px;
}

.page-topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
}

.back-btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.back-btn svg {
  width: 14px;
  height: 14px;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.10);
}

.page-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #e8e8ea;
}

.text-btn {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
}

.text-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.text-btn.placeholder {
  cursor: default;
}

.section {
  padding: 10px 12px;
  border-radius: 12px;
  margin-bottom: 12px;
  background: rgba(24, 24, 30, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.10);
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
}

.volume-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mute-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  flex-shrink: 0;
}

.mute-btn svg {
  width: 15px;
  height: 15px;
}

.mute-btn.active {
  color: var(--focus-color);
  border-color: color-mix(in srgb, var(--focus-color) 45%, transparent);
  background: color-mix(in srgb, var(--focus-color) 12%, transparent);
}

.volume-slider {
  flex: 1;
}

.volume-value {
  min-width: 32px;
  text-align: right;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  font-variant-numeric: tabular-nums;
}

.volume-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.section-head .section-title {
  margin-bottom: 0;
}

.notif-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notif-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
}

.notif-item.unread {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
}

.notif-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  margin-top: 5px;
  background: rgba(255, 255, 255, 0.18);
  flex-shrink: 0;
}

.notif-item.unread .notif-dot {
  background: var(--focus-color);
}

.notif-body {
  flex: 1;
  min-width: 0;
}

.notif-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.notif-title {
  font-size: 12px;
  font-weight: 600;
  color: #e8e8ea;
}

.notif-time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.40);
  font-variant-numeric: tabular-nums;
}

.notif-detail {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 2px;
}

.empty {
  flex: 1;
  display: grid;
  place-items: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
}
</style>
