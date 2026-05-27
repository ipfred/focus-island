<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useRadio, CATEGORY_LABELS, type StationCategory } from '../composables/useRadio'

const { stations, currentStation, playing, loading, error, volume, toggle, switchStation, setVolume } = useRadio()

const stationsByCategory = computed(() => {
  const grouped = new Map<StationCategory, typeof stations>()
  stations.forEach(station => {
    if (!grouped.has(station.category)) {
      grouped.set(station.category, [])
    }
    grouped.get(station.category)!.push(station)
  })
  return grouped
})

const scrollContainer = ref<HTMLElement | null>(null)
const showScrollToPlaying = ref(false)

function handleScroll() {
  if (!scrollContainer.value) return
  // 滚动超过 50px 时显示快速定位按钮
  showScrollToPlaying.value = scrollContainer.value.scrollTop > 50
}

async function scrollToPlaying() {
  if (!currentStation.value) return
  await nextTick()
  const activeItem = document.querySelector('.station-item.active')
  if (activeItem) {
    activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}
</script>

<template>
  <div class="radio-page">
    <!-- Now Playing (Fixed) -->
    <div class="now-playing">
      <div class="radio-frame">
        <div class="radio-glow" />
        <div class="radio-content">
          <div class="station-info">
            <div class="station-name">{{ currentStation?.name ?? '选择一个电台' }}</div>
            <div class="station-desc">{{ currentStation?.description ?? '让音乐陪伴你的专注时光' }}</div>
          </div>
          <div class="player-controls">
            <button
              class="play-btn"
              :class="{ 'is-playing': playing }"
              :disabled="!currentStation"
              @click="toggle"
            >
              <svg v-if="loading" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="7" cy="12" r="1.8" opacity="0.3" />
                <circle cx="12" cy="12" r="1.8" opacity="0.6" />
                <circle cx="17" cy="12" r="1.8" />
              </svg>
              <svg v-else-if="playing" viewBox="0 0 24 24" fill="currentColor">
                <rect x="7" y="5" width="3.5" height="14" rx="1" />
                <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.5 5.3v13.4a1 1 0 0 0 1.45.9l11.1-6.7a1 1 0 0 0 0-1.8L8.95 4.4a1 1 0 0 0-1.45.9Z" />
              </svg>
            </button>
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
              <span class="vol-value">{{ volume }}</span>
            </div>
          </div>
          <div v-if="error" class="error-msg">{{ error }}</div>
        </div>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="station-list-wrapper" ref="scrollContainer" @scroll="handleScroll">
      <!-- Station List by Category -->
      <div v-for="[category, categoryStations] in stationsByCategory" :key="category" class="category-section">
        <div class="category-title">{{ CATEGORY_LABELS[category] }}</div>
        <div class="station-list">
          <button
            v-for="station in categoryStations"
            :key="station.id"
            class="station-item"
            :class="{ active: currentStation?.id === station.id }"
            @click="switchStation(station.id)"
          >
            <div class="item-icon">
              <!-- Code Radio: code brackets -->
              <svg v-if="station.icon === 'code'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
              </svg>
              <!-- Groove Salad: equalizer bars -->
              <svg v-else-if="station.icon === 'wave'" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="13" width="3" height="7" rx="1" opacity="0.7" />
                <rect x="8" y="9" width="3" height="11" rx="1" opacity="0.85" />
                <rect x="13" y="6" width="3" height="14" rx="1" />
                <rect x="18" y="11" width="3" height="9" rx="1" opacity="0.7" />
              </svg>
              <!-- Drone Zone: concentric waves -->
              <svg v-else-if="station.icon === 'drone'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <circle cx="12" cy="12" r="3" />
                <circle cx="12" cy="12" r="7" opacity="0.55" />
                <circle cx="12" cy="12" r="11" opacity="0.25" />
              </svg>
              <!-- Deep Space One: planet with ring -->
              <svg v-else-if="station.icon === 'planet'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <circle cx="12" cy="11" r="5" />
                <ellipse cx="12" cy="11" rx="9" ry="3" transform="rotate(-18 12 11)" />
              </svg>
              <!-- Space Station: star sparkle -->
              <svg v-else-if="station.icon === 'star'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l1.5 6.5L20 9l-5 4.5L17 20l-5-3-5 3 1.5-7L4 9l6.5-.5z" />
              </svg>
              <!-- Ambient Pill: pill shape -->
              <svg v-else-if="station.icon === 'pill'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <rect x="3" y="7" width="18" height="10" rx="5" />
              </svg>
              <!-- Lo-Fi / Coffee: coffee cup -->
              <svg v-else-if="station.icon === 'coffee'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />
              </svg>
              <!-- Jazz: saxophone -->
              <svg v-else-if="station.icon === 'jazz'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M8 6h8M7 10h10M7 14h10M8 18h8" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
              <!-- Secret Agent: spy glass -->
              <svg v-else-if="station.icon === 'spy'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
                <circle cx="11" cy="11" r="3" />
              </svg>
              <!-- DEF CON: hacker terminal -->
              <svg v-else-if="station.icon === 'hacker'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4M7 8l3 3-3 3M13 14h4" />
              </svg>
              <!-- 本地音乐: folder -->
              <svg v-else-if="station.icon === 'folder'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
              </svg>
              <div v-if="currentStation?.id === station.id && playing" class="playing-indicator">
                <span /><span /><span />
              </div>
            </div>
            <div class="item-content">
              <div class="item-header">
                <div class="item-name">{{ station.name }}</div>
                <div class="item-tags">
                  <span v-for="tag in station.tags.slice(0, 2)" :key="tag" class="tag">{{ tag }}</span>
                </div>
              </div>
              <div class="item-desc">{{ station.description }}</div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Scroll to Playing Button -->
    <transition name="fade-scale">
      <button
        v-if="showScrollToPlaying && currentStation"
        class="scroll-to-playing-btn"
        @click="scrollToPlaying"
        title="定位到当前播放"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      </button>
    </transition>
  </div>
</template>

<style scoped>
@reference "../styles.css";

.radio-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.now-playing {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(20, 20, 22, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding: 8px 10px 8px;
}

.radio-frame {
  position: relative;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%);
  border-radius: 18px;
  padding: 6px;
  overflow: visible;
}

.radio-frame::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 18px;
  padding: 2px;
  background: linear-gradient(135deg,
    var(--focus-color) 0%,
    color-mix(in srgb, var(--focus-color) 60%, #a855f7) 50%,
    color-mix(in srgb, var(--focus-color) 40%, #06b6d4) 100%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0.6;
  transition: opacity 0.3s ease;
}

.radio-frame:hover::before {
  opacity: 0.85;
}

.radio-glow {
  position: absolute;
  inset: -40px;
  background: radial-gradient(circle at 50% 0%,
    color-mix(in srgb, var(--focus-color) 15%, transparent) 0%,
    transparent 60%
  );
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
  z-index: -1;
}

.now-playing:hover .radio-glow {
  opacity: 1;
}

.radio-content {
  position: relative;
  background: linear-gradient(145deg,
    rgba(28, 28, 32, 0.95) 0%,
    rgba(20, 20, 24, 0.98) 100%
  );
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  backdrop-filter: blur(10px);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.3s ease;
}

.now-playing:hover .radio-content {
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.5),
    0 4px 12px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(0, 0, 0, 0.25),
    0 0 0 1px color-mix(in srgb, var(--focus-color) 10%, transparent);
  transform: translateY(-1px);
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

.player-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.play-btn {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.play-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle, var(--focus-color) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.play-btn:hover {
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
  transform: scale(1.05);
}

.play-btn:hover::before {
  opacity: 0.15;
}

.play-btn.is-playing {
  background: linear-gradient(135deg, var(--focus-color) 0%, color-mix(in srgb, var(--focus-color) 85%, #000) 100%);
  border-color: var(--focus-color);
  color: #fff;
  box-shadow: 0 0 20px color-mix(in srgb, var(--focus-color) 40%, transparent),
              0 0 40px color-mix(in srgb, var(--focus-color) 20%, transparent);
  animation: pulse-glow 2s ease-in-out infinite;
}

.play-btn.is-playing::before {
  opacity: 0;
}

.play-btn.is-playing:hover {
  transform: scale(1.05);
  box-shadow: 0 0 25px color-mix(in srgb, var(--focus-color) 50%, transparent),
              0 0 50px color-mix(in srgb, var(--focus-color) 25%, transparent);
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 20px color-mix(in srgb, var(--focus-color) 40%, transparent),
                0 0 40px color-mix(in srgb, var(--focus-color) 20%, transparent);
  }
  50% {
    box-shadow: 0 0 25px color-mix(in srgb, var(--focus-color) 50%, transparent),
                0 0 50px color-mix(in srgb, var(--focus-color) 30%, transparent);
  }
}

.play-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  transform: none;
}

.play-btn:disabled:hover {
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);
  transform: none;
}

.play-btn:disabled::before {
  opacity: 0;
}

.play-btn svg {
  width: 20px;
  height: 20px;
  position: relative;
  z-index: 1;
}

.error-msg {
  font-size: 11px;
  color: #e85d3a;
}

.volume-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.vol-icon {
  width: 14px;
  height: 14px;
  color: rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

.volume-slider {
  flex: 1;
  min-width: 0;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: linear-gradient(90deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.12) 100%
  );
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  position: relative;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.9) 100%);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3),
              0 0 0 2px rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4),
              0 0 0 3px color-mix(in srgb, var(--focus-color) 30%, transparent);
}

.volume-slider::-webkit-slider-thumb:active {
  transform: scale(1.05);
}

.vol-value {
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  min-width: 20px;
  text-align: right;
  flex-shrink: 0;
}

.station-list-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 16px 20px;
  overflow-y: auto;
}

.category-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.65);
  padding-left: 2px;
  letter-spacing: 0.3px;
}

.station-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.station-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.7);
  text-align: left;
}

.station-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
}

.station-item.active {
  background: color-mix(in srgb, var(--focus-color) 10%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 35%, transparent);
  color: #fff;
}

.item-icon {
  position: relative;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  transition: background 0.2s ease;
}

.station-item:hover .item-icon {
  background: rgba(255, 255, 255, 0.08);
}

.station-item.active .item-icon {
  background: color-mix(in srgb, var(--focus-color) 20%, transparent);
}

.item-icon svg {
  width: 20px;
  height: 20px;
}

.playing-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  display: flex;
  align-items: flex-end;
  gap: 1.5px;
  height: 8px;
}

.playing-indicator span {
  width: 2px;
  background: var(--focus-color);
  border-radius: 1px;
  animation: eq-bar 0.8s ease-in-out infinite;
}

.playing-indicator span:nth-child(1) {
  height: 3px;
  animation-delay: 0s;
}

.playing-indicator span:nth-child(2) {
  height: 6px;
  animation-delay: 0.15s;
}

.playing-indicator span:nth-child(3) {
  height: 4px;
  animation-delay: 0.3s;
}

@keyframes eq-bar {
  0%, 100% { height: 3px; }
  50% { height: 8px; }
}

.item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.item-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.tag {
  font-size: 9px;
  font-weight: 500;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  transition: all 0.2s ease;
}

.station-item:hover .tag {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.65);
}

.station-item.active .tag {
  background: color-mix(in srgb, var(--focus-color) 25%, transparent);
  color: color-mix(in srgb, var(--focus-color) 80%, white);
}

.item-desc {
  font-size: 11px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.45);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.station-item.active .item-desc {
  color: rgba(255, 255, 255, 0.65);
}

.scroll-to-playing-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--focus-color);
  border: none;
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
  z-index: 20;
}

.scroll-to-playing-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15);
}

.scroll-to-playing-btn:active {
  transform: scale(0.95);
}

.scroll-to-playing-btn svg {
  width: 22px;
  height: 22px;
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.25s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.station-list-wrapper::-webkit-scrollbar {
  width: 4px;
}

.station-list-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.station-list-wrapper::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
}
</style>
