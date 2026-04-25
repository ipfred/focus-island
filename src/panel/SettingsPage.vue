<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useSettings, presetThemes, type ColorMode } from '../composables/useSettings'
import AboutDialog from './AboutDialog.vue'

const emit = defineEmits<{ back: [] }>()

const { settings } = useSettings()

const opacityPercent = (v: number) => Math.round(v * 100) + '%'

const showAbout = ref(false)
const isRecording = ref(false)

const colorModeOptions: Array<{ id: ColorMode; label: string }> = [
  { id: 'dark', label: '深色' },
  { id: 'light', label: '浅色' },
  { id: 'system', label: '跟随系统' },
]

function formatShortcut(key: string): string {
  if (!key) return '无'
  return key.replace('CommandOrControl', navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl')
    .replace('Alt', 'Alt')
    .replace('Shift', '⇧')
    .replace('Control', 'Ctrl')
}

function startRecording() {
  isRecording.value = true
}

function stopRecording() {
  isRecording.value = false
}

let recordedKey = ''

function buildCombo(e: KeyboardEvent): string {
  const mods: string[] = []
  if (e.ctrlKey) mods.push('Control')
  if (e.altKey) mods.push('Alt')
  if (e.metaKey) mods.push('CommandOrControl')
  if (e.shiftKey) mods.push('Shift')

  const code = e.code
  let keyName: string
  if (code.startsWith('Key')) keyName = code.slice(3)
  else if (code.startsWith('Digit')) keyName = code.slice(5)
  else keyName = code

  return mods.join('+') + '+' + keyName
}

function onRecordKeydown(e: KeyboardEvent) {
  if (!isRecording.value) return
  // Skip modifier-only presses
  if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.key === 'Shift') return
  // Skip if no modifier is held
  if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) return

  e.preventDefault()
  e.stopPropagation()
  recordedKey = buildCombo(e)
}

function onRecordKeyup(e: KeyboardEvent) {
  if (!isRecording.value) return

  // Fallback: if keydown was intercepted (e.g. Option+Space on macOS),
  // capture the combo from keyup instead
  if (!recordedKey && (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey)) {
    if (e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta' && e.key !== 'Shift') {
      recordedKey = buildCombo(e)
    }
  }

  // Finalize when all modifiers are released
  if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
    if (recordedKey) {
      settings.value.shortcutKey = recordedKey
      recordedKey = ''
      isRecording.value = false
    } else {
      // Released all mods without hitting a key — cancel
      isRecording.value = false
    }
  }
}

function goBack() {
  showAbout.value = false
  stopRecording()
  recordedKey = ''
  nextTick()
  emit('back')
}

function switchColorMode(mode: ColorMode) {
  if (settings.value.colorMode === mode) return
  settings.value.colorMode = mode
}

onMounted(() => {
  document.addEventListener('keydown', onRecordKeydown, true)
  document.addEventListener('keyup', onRecordKeyup, true)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onRecordKeydown, true)
  document.removeEventListener('keyup', onRecordKeyup, true)
})
</script>

<template>
  <div class="settings-page" :class="{ 'blurred': showAbout }">
    <div class="settings-header">
      <button class="back-btn" @click="goBack">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <button class="about-btn" @click="showAbout = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
      </button>
    </div>

    <div class="settings-section">
      <div class="section-title">显示模式</div>
      <div class="mode-toggle" role="group" aria-label="主题模式">
        <button
          v-for="option in colorModeOptions"
          :key="option.id"
          type="button"
          class="mode-btn"
          :class="{ active: settings.colorMode === option.id }"
          @click="switchColorMode(option.id)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <!-- 外观 -->
    <div class="settings-section">
      <div class="section-title">外观</div>
      <div class="slider-row">
        <label class="slider-label">透明度</label>
        <input
          type="range"
          class="opacity-slider"
          min="0"
          max="0.9"
          step="0.01"
          v-model.number="settings.islandOpacity"
        />
        <span class="opacity-value">{{ opacityPercent(settings.islandOpacity) }}</span>
      </div>
      <div class="slider-row">
        <label class="slider-label">大小</label>
        <input
          type="range"
          class="opacity-slider"
          min="0.5"
          max="1.5"
          step="0.1"
          v-model.number="settings.islandScale"
        />
        <span class="opacity-value">{{ Math.round(settings.islandScale * 100) }}%</span>
      </div>
    </div>

    <!-- 番茄钟 -->
    <div class="settings-section">
      <div class="section-title">番茄钟</div>
      <div class="duration-grid">
        <div class="duration-cell">
          <label class="duration-label">专注</label>
          <div class="stepper">
            <button class="stepper-btn" @click="settings.focusDuration = Math.max(1, settings.focusDuration - 5)">−</button>
            <span class="stepper-value">{{ settings.focusDuration }}</span>
            <button class="stepper-btn" @click="settings.focusDuration = Math.min(120, settings.focusDuration + 5)">+</button>
          </div>
          <span class="duration-unit">分</span>
        </div>
        <div class="duration-cell">
          <label class="duration-label">休息</label>
          <div class="stepper">
            <button class="stepper-btn" @click="settings.breakDuration = Math.max(1, settings.breakDuration - 1)">−</button>
            <span class="stepper-value">{{ settings.breakDuration }}</span>
            <button class="stepper-btn" @click="settings.breakDuration = Math.min(30, settings.breakDuration + 1)">+</button>
          </div>
          <span class="duration-unit">分</span>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="settings-section">
      <div class="section-title">快捷操作</div>
      <div class="shortcut-row">
        <span class="shortcut-label">打开面板</span>
        <button
          class="shortcut-recorder"
          :class="{ recording: isRecording }"
          @click="startRecording"
          tabindex="0"
        >
          <span v-if="isRecording" class="recording-hint">按下组合键...</span>
          <span v-else>{{ formatShortcut(settings.shortcutKey) }}</span>
        </button>
        <span class="shortcut-hint" v-if="!isRecording">推荐: Ctrl+P、Alt+Space;默认Esc 关闭面板</span>
      </div>
    </div>

    <!-- 色彩主题 -->
    <div class="settings-section">
      <div class="section-title">色彩主题</div>
      <div class="theme-grid">
        <button
          v-for="theme in presetThemes"
          :key="theme.id"
          class="theme-card"
          :class="{ active: settings.activeThemeId === theme.id }"
          @click="settings.activeThemeId = theme.id"
        >
          <div class="theme-colors">
            <span class="color-dot" :style="{ background: theme.focusColor }"></span>
            <span class="color-dot" :style="{ background: theme.breakColor }"></span>
            <span class="color-dot" :style="{ background: theme.idleColor }"></span>
          </div>
          <span class="theme-name">{{ theme.name }}</span>
          <span v-if="settings.activeThemeId === theme.id" class="theme-check">✓</span>
        </button>
      </div>
    </div>
  </div>

  <!-- 关于弹窗 -->
  <AboutDialog v-if="showAbout" @close="showAbout = false" />
</template>

<style scoped>
@reference "../styles.css";

.settings-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  color: #e8e8ea;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.back-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.about-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.about-btn:hover {
  color: var(--focus-color);
}

.settings-section {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.section-title {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.mode-toggle {
  display: flex;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--focus-color) 82%, transparent);
  border-radius: 999px;
  overflow: hidden;
  width: fit-content;
  max-width: 100%;
}

.mode-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  height: 28px;
  padding: 0 14px;
  cursor: pointer;
  transition: background 0.22s ease, color 0.22s ease;
  white-space: nowrap;
}

.mode-btn + .mode-btn {
  border-left: 1px solid color-mix(in srgb, var(--focus-color) 58%, transparent);
}

.mode-btn:hover {
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
}

.mode-btn.active {
  background: var(--focus-color);
  color: #fff;
}

/* 外观 - 滑块行 */
.slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.slider-row:last-child {
  margin-bottom: 0;
}

.slider-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  width: 40px;
  flex-shrink: 0;
}

.opacity-slider {
  flex: 1;
  appearance: none;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.12);
  outline: none;
}

.opacity-slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.opacity-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  min-width: 32px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* 番茄钟 */
.duration-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.duration-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.duration-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  flex-shrink: 0;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 0;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  overflow: hidden;
}

.stepper-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  width: 24px;
  height: 24px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stepper-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.stepper-value {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  min-width: 26px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.duration-unit {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

/* 快捷操作 */
.shortcut-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.shortcut-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.shortcut-recorder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}

.shortcut-recorder:hover {
  background: rgba(255, 255, 255, 0.10);
  border-color: rgba(255, 255, 255, 0.25);
}

.shortcut-recorder.recording {
  border-color: var(--focus-color);
  background: color-mix(in srgb, var(--focus-color) 15%, transparent);
  box-shadow: 0 0 0 1px var(--focus-color);
  animation: recorder-pulse 1.2s ease-in-out infinite;
}

@keyframes recorder-pulse {
  0%, 100% { box-shadow: 0 0 0 1px var(--focus-color); }
  50% { box-shadow: 0 0 0 2px var(--focus-color), 0 0 8px color-mix(in srgb, var(--focus-color) 40%, transparent); }
}

.recording-hint {
  color: var(--focus-color);
  font-weight: 500;
}

.shortcut-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
}

/* 主题 */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 8px 4px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.theme-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}

.theme-card.active {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.25);
}

.theme-colors {
  display: flex;
  gap: 3px;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.theme-name {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.2;
  white-space: nowrap;
}

.theme-check {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 10px;
  color: var(--focus-color);
  font-weight: 700;
}

.settings-page::-webkit-scrollbar { width: 4px; }
.settings-page::-webkit-scrollbar-track { background: transparent; }
.settings-page::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

/* 毛玻璃模糊效果 */
.settings-page.blurred {
  filter: blur(8px);
  opacity: 0.7;
  transition: filter 0.2s ease-out, opacity 0.2s ease-out;
}
</style>
