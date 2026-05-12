<script setup lang="ts">
import { useRadio } from '../composables/useRadio'

const { stations, currentStation, playing, loading, error, volume, toggle, switchStation, setVolume } = useRadio()
</script>

<template>
  <div class="radio-page">
    <!-- Now Playing -->
    <div class="now-playing">
      <div class="station-info">
        <div class="station-name">{{ currentStation?.name ?? '选择一个电台' }}</div>
        <div class="station-desc">{{ currentStation?.description ?? '让音乐陪伴你的专注时光' }}</div>
      </div>
      <div class="controls">
        <button class="play-btn" :disabled="!currentStation" @click="toggle">
          <svg v-if="loading" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
          <svg v-else-if="playing" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28a1 1 0 0 0-1.5.86Z" />
          </svg>
        </button>
      </div>
      <div v-if="error" class="error-msg">{{ error }}</div>
      <div class="volume-row">
        <svg class="vol-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
        </svg>
        <input
          type="range"
          class="volume-slider"
          min="0"
          max="100"
          :value="volume"
          @input="setVolume(Number(($event.target as HTMLInputElement).value))"
        />
        <span class="vol-value">{{ volume }}%</span>
      </div>
    </div>

    <!-- Station List -->
    <div class="section-title">电台列表</div>
    <div class="station-grid">
      <button
        v-for="station in stations"
        :key="station.id"
        class="station-card"
        :class="{ active: currentStation?.id === station.id }"
        @click="switchStation(station.id)"
      >
        <div class="card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <div v-if="currentStation?.id === station.id && playing" class="playing-indicator">
            <span /><span /><span />
          </div>
        </div>
        <div class="card-name">{{ station.name }}</div>
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "../styles.css";

.radio-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 4px;
  overflow-y: auto;
}

.now-playing {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.station-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.station-name {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.station-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.controls {
  display: flex;
  justify-content: center;
}

.play-btn {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--focus-color);
  border: none;
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.play-btn:hover {
  transform: scale(1.06);
}

.play-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.play-btn svg {
  width: 22px;
  height: 22px;
}

.play-btn .spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-msg {
  font-size: 11px;
  color: #e85d3a;
  text-align: center;
}

.volume-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vol-icon {
  width: 16px;
  height: 16px;
  color: rgba(255, 255, 255, 0.45);
  flex-shrink: 0;
}

.volume-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.vol-value {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  min-width: 30px;
  text-align: right;
}

.section-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.station-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.station-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.6);
}

.station-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
}

.station-card.active {
  background: color-mix(in srgb, var(--focus-color) 12%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 40%, transparent);
  color: var(--focus-color);
}

.card-icon {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-icon svg {
  width: 28px;
  height: 28px;
}

.playing-indicator {
  position: absolute;
  bottom: -2px;
  right: -4px;
  display: flex;
  align-items: flex-end;
  gap: 1.5px;
  height: 10px;
}

.playing-indicator span {
  width: 2px;
  background: var(--focus-color);
  border-radius: 1px;
  animation: eq-bar 0.8s ease-in-out infinite;
}

.playing-indicator span:nth-child(1) {
  height: 4px;
  animation-delay: 0s;
}

.playing-indicator span:nth-child(2) {
  height: 7px;
  animation-delay: 0.15s;
}

.playing-indicator span:nth-child(3) {
  height: 5px;
  animation-delay: 0.3s;
}

@keyframes eq-bar {
  0%, 100% { height: 3px; }
  50% { height: 9px; }
}

.card-name {
  font-size: 11px;
  font-weight: 500;
  text-align: center;
}

.radio-page::-webkit-scrollbar {
  width: 4px;
}

.radio-page::-webkit-scrollbar-track {
  background: transparent;
}

.radio-page::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}
</style>
