<script setup lang="ts">
import { computed } from 'vue'
import { useSettings, presetThemes } from '../composables/useSettings'

const emit = defineEmits<{ back: [] }>()

const { settings } = useSettings()

const currentTheme = computed(() =>
  presetThemes.find(t => t.id === settings.value.activeThemeId) ?? presetThemes[0]
)

const opacityPercent = (v: number) => Math.round(v * 100) + '%'
</script>

<template>
  <div class="settings-page">
    <div class="settings-header">
      <button class="back-btn" @click="emit('back')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
    </div>

    <!-- 透明度 -->
    <div class="settings-section">
      <div class="section-title">灵动岛透明度</div>
      <div class="opacity-row">
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
    </div>

    <!-- 灵动岛大小 -->
    <div class="settings-section">
      <div class="section-title">灵动岛大小</div>
      <div class="opacity-row">
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

    <!-- 番茄钟时间 -->
    <div class="settings-section">
      <div class="section-title">番茄钟时间</div>
      <div class="duration-row">
        <label class="duration-label">专注时间</label>
        <div class="stepper">
          <button class="stepper-btn" @click="settings.focusDuration = Math.max(1, settings.focusDuration - 5)">−</button>
          <span class="stepper-value">{{ settings.focusDuration }}</span>
          <button class="stepper-btn" @click="settings.focusDuration = Math.min(120, settings.focusDuration + 5)">+</button>
        </div>
        <span class="duration-unit">分钟</span>
      </div>
      <div class="duration-row">
        <label class="duration-label">休息时间</label>
        <div class="stepper">
          <button class="stepper-btn" @click="settings.breakDuration = Math.max(1, settings.breakDuration - 1)">−</button>
          <span class="stepper-value">{{ settings.breakDuration }}</span>
          <button class="stepper-btn" @click="settings.breakDuration = Math.min(30, settings.breakDuration + 1)">+</button>
        </div>
        <span class="duration-unit">分钟</span>
      </div>
    </div>

    <!-- 颜色主题 -->
    <div class="settings-section">
      <div class="section-title">颜色主题</div>
      <div class="theme-list">
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
      <div class="theme-legend">
        <span class="legend-item"><span class="color-dot" :style="{ background: currentTheme.focusColor }"></span>专注</span>
        <span class="legend-item"><span class="color-dot" :style="{ background: currentTheme.breakColor }"></span>休息</span>
        <span class="legend-item"><span class="color-dot" :style="{ background: currentTheme.idleColor }"></span>空闲</span>
      </div>
    </div>
  </div>
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

.settings-section {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.section-title {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

/* 透明度 */
.opacity-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.opacity-slider {
  flex: 1;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.12);
  outline: none;
}

.opacity-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.opacity-value {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* 时长 */
.duration-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.duration-row:last-child {
  margin-bottom: 0;
}

.duration-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  min-width: 60px;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 0;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.stepper-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 16px;
  width: 32px;
  height: 30px;
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
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  min-width: 32px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.duration-unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

/* 主题 */
.theme-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.theme-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  text-align: left;
}

.theme-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}

.theme-card.active {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.theme-colors {
  display: flex;
  gap: 4px;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.theme-name {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.theme-check {
  font-size: 14px;
  color: var(--focus-color);
  font-weight: 700;
}

.theme-legend {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  padding-top: 8px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.settings-page::-webkit-scrollbar { width: 4px; }
.settings-page::-webkit-scrollbar-track { background: transparent; }
.settings-page::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
</style>
