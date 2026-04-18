<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useTimerBridge } from '../composables/useTimerBridge'
import { useSettings } from '../composables/useSettings'
import TaskArea from './TaskArea.vue'
import SettingsPage from './SettingsPage.vue'
import CompletedPage from './CompletedPage.vue'
import MemoPage from './MemoPage.vue'
import StatsPage from './StatsPage.vue'
import PanelTitleBar from './PanelTitleBar.vue'

interface PanelTransitionMetrics {
  island_x: number
  island_y: number
  island_width: number
  island_height: number
  panel_x: number
  panel_y: number
  panel_width: number
  panel_height: number
}

const { startBridge } = useTimerBridge()
useSettings()

const REPOSITION_BURST_DELAYS = [0, 90, 220]
const PANEL_CLOSE_DURATION = 240
const CLOSE_FALLBACK_BUFFER = 140
const IS_MACOS = navigator.userAgent.toLowerCase().includes('mac')

const currentView = ref<'tasks' | 'settings' | 'completed' | 'memos' | 'stats'>('tasks')

const navItems = [
  {
    key: 'tasks',
    label: '任务',
    title: '任务清单',
    iconPaths: ['M4 6h2', 'M4 12h2', 'M4 18h2', 'M9 6h11', 'M9 12h11', 'M9 18h11'],
  },
  {
    key: 'completed',
    label: '完成',
    title: '完成',
    iconPaths: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M9 12l2 2 4-4'],
  },
  {
    key: 'memos',
    label: '备忘',
    title: '备忘录',
    iconPaths: ['M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M9 13h6', 'M9 17h6', 'M9 9h1'],
  },
  {
    key: 'stats',
    label: '统计',
    title: '统计',
    iconPaths: ['M3 3v18h18', 'M8 16v-6', 'M13 16V8', 'M18 16v-3'],
  },
  {
    key: 'settings',
    label: '设置',
    title: '设置',
    iconPaths: [
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
      'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.39 1.26 1 1.51.16.07.33.1.51.1H21a2 2 0 1 1 0 4h-.09c-.66 0-1.26.39-1.51 1Z',
    ],
  },
] as const

const currentTitleMeta = computed(() =>
  navItems.find(item => item.key === currentView.value) ?? navItems[0]
)
const isClosing = ref(false)
const panelRootRef = ref<HTMLElement | null>(null)
const panelAnimState = ref<'hidden' | 'steady' | 'opening-ready' | 'opening' | 'closing'>('hidden')

let unlistenResize: (() => void) | null = null
let unlistenMove: (() => void) | null = null
let unlistenTransition: (() => void) | null = null
let unlistenFocus: (() => void) | null = null
let repositionTimers: number[] = []
let closeFallbackTimer: number | null = null
let suppressMoveEventsUntil = 0

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function applyTransitionVars(metrics: PanelTransitionMetrics) {
  const root = panelRootRef.value
  if (!root) return

  const panelW = Math.max(1, metrics.panel_width)
  const panelH = Math.max(1, metrics.panel_height)
  const scaleX = clamp(metrics.island_width / panelW, 0.1, 1)
  const scaleY = clamp(metrics.island_height / panelH, 0.08, 0.18)

  const islandCenterX = metrics.island_x + metrics.island_width / 2
  const islandCenterY = metrics.island_y + metrics.island_height / 2
  const panelCenterX = metrics.panel_x + panelW / 2
  const panelCenterY = metrics.panel_y + panelH / 2

  const translateX = islandCenterX - panelCenterX
  const translateY = islandCenterY - panelCenterY
  const closeArc = clamp(Math.abs(translateY) * 0.14, 10, 26) * (translateY < 0 ? -1 : 1)
  const fromRadius = `${Math.max(12, Math.round(metrics.island_height / 2))}px`
  const topLift = `${Math.round(clamp(metrics.island_height * 0.24, 8, 14))}px`

  root.style.setProperty('--panel-from-x', `${translateX.toFixed(2)}px`)
  root.style.setProperty('--panel-from-y', `${translateY.toFixed(2)}px`)
  root.style.setProperty('--panel-from-sx', scaleX.toFixed(4))
  root.style.setProperty('--panel-from-sy', scaleY.toFixed(4))
  root.style.setProperty('--panel-from-radius', fromRadius)
  root.style.setProperty('--panel-close-arc', `${closeArc.toFixed(2)}px`)
  root.style.setProperty('--panel-top-lift', topLift)
}

async function prepareTransitionVars() {
  const metrics = await invoke<PanelTransitionMetrics | null>('get_panel_transition_metrics')
  if (metrics) applyTransitionVars(metrics)
}

function clearCloseFallback() {
  if (closeFallbackTimer) {
    window.clearTimeout(closeFallbackTimer)
    closeFallbackTimer = null
  }
}

function scheduleCloseFallback() {
  clearCloseFallback()
  closeFallbackTimer = window.setTimeout(() => {
    void finishCloseAnimation()
  }, PANEL_CLOSE_DURATION + CLOSE_FALLBACK_BUFFER)
}

async function repositionPanel() {
  suppressMoveEventsUntil = Date.now() + 250
  await invoke('position_panel_under_island')
}

function clearRepositionTimers() {
  for (const timer of repositionTimers) {
    window.clearTimeout(timer)
  }
  repositionTimers = []
}

function scheduleReposition() {
  if (panelAnimState.value !== 'steady') return
  clearRepositionTimers()
  repositionTimers = REPOSITION_BURST_DELAYS.map(delay =>
    window.setTimeout(() => {
      if (panelAnimState.value !== 'steady') return
      void repositionPanel()
    }, delay),
  )
}

async function finishCloseAnimation() {
  clearCloseFallback()
  panelAnimState.value = 'hidden'
  isClosing.value = false
  await invoke('hide_panel')
}

function runOpenAnimation() {
  if (panelAnimState.value === 'opening' || panelAnimState.value === 'opening-ready') return
  clearCloseFallback()
  panelAnimState.value = 'opening-ready'
  requestAnimationFrame(() => {
    panelAnimState.value = 'opening'
  })
}

async function runCloseAnimation() {
  if (panelAnimState.value === 'closing') return
  await prepareTransitionVars()
  scheduleCloseFallback()
  panelAnimState.value = 'closing'
}

async function onWindowTransition(payload: string) {
  if (payload === 'open') {
    isClosing.value = false
    panelAnimState.value = 'hidden'
    await prepareTransitionVars()
    void invoke('emit_island_panel_motion', { phase: 'open' })
    runOpenAnimation()
    return
  }

  if (payload === 'close') {
    void invoke('emit_island_panel_motion', { phase: 'close' })
    await runCloseAnimation()
  }
}

async function onPanelAnimationEnd(event: AnimationEvent) {
  if (event.target !== panelRootRef.value) return

  if (event.animationName === 'panel-open' && panelAnimState.value === 'opening') {
    panelAnimState.value = 'steady'
    void repositionPanel()
    if (!IS_MACOS) {
      try {
        await getCurrentWindow().setFocus()
      } catch {
        // ignore focus errors during animation completion
      }
    }
    return
  }

  if (event.animationName === 'panel-close' && panelAnimState.value === 'closing') {
    void finishCloseAnimation()
  }
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return
  if (event.key !== 'Escape' || event.repeat) return
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
  if (isClosing.value || panelAnimState.value === 'closing' || panelAnimState.value === 'hidden') return
  event.preventDefault()
  void closeWindow()
}

onMounted(async () => {
  startBridge()
  await invoke('set_click_through', { ignore: false })
  window.addEventListener('keydown', onPanelKeydown)

  const win = getCurrentWebviewWindow()
  try {
    await win.setBackgroundColor([0, 0, 0, 0])
  } catch {
    // ignore if not supported or denied
  }

  scheduleReposition()
  unlistenResize = await getCurrentWindow().onResized(() => {
    scheduleReposition()
  })
  unlistenMove = await getCurrentWindow().onMoved(() => {
    if (Date.now() < suppressMoveEventsUntil) return
    scheduleReposition()
  })

  unlistenTransition = await listen<string>('panel-window-transition', event => {
    void onWindowTransition(String(event.payload ?? ''))
  })

  unlistenFocus = await win.onFocusChanged(({ payload: focused }) => {
    if (focused && panelAnimState.value === 'steady') {
      isClosing.value = false
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onPanelKeydown)
  clearRepositionTimers()
  clearCloseFallback()
  if (unlistenResize) unlistenResize()
  if (unlistenMove) unlistenMove()
  if (unlistenTransition) unlistenTransition()
  if (unlistenFocus) unlistenFocus()
})

async function closeWindow() {
  if (isClosing.value || panelAnimState.value === 'closing') return
  isClosing.value = true
  await invoke('animate_panel_close')
}
</script>

<template>
  <div
    ref="panelRootRef"
    class="panel-root"
    :class="{
      'motion-hidden': panelAnimState === 'hidden',
      'motion-opening-ready': panelAnimState === 'opening-ready',
      'motion-opening': panelAnimState === 'opening',
      'motion-closing': panelAnimState === 'closing'
    }"
    @animationend="onPanelAnimationEnd"
  >
    <div class="panel-sheen" />
    <div class="panel-vignette" />
    <div class="panel-inner">
      <PanelTitleBar
        :title="currentTitleMeta.title"
        :icon-paths="[...currentTitleMeta.iconPaths]"
        @close="closeWindow"
      />
      <div class="panel-body">
        <TaskArea v-if="currentView === 'tasks'" category="today" @close="closeWindow" />
        <SettingsPage v-else-if="currentView === 'settings'" @back="currentView = 'tasks'" />
        <MemoPage v-else-if="currentView === 'memos'" @back="currentView = 'tasks'" />
        <StatsPage v-else-if="currentView === 'stats'" @back="currentView = 'tasks'" />
        <CompletedPage v-else @back="currentView = 'tasks'" />
      </div>
      <nav class="panel-nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-btn"
          :class="{ active: currentView === item.key }"
          @click="currentView = item.key"
        >
          <span class="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path
                v-for="(path, pathIndex) in item.iconPaths"
                :key="`${item.key}-icon-${pathIndex}`"
                :d="path"
              />
            </svg>
          </span>
          <span class="nav-label">{{ item.label }}</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.panel-root {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background:
    var(--panel-shell-bg);
  border-radius: 12px;
  border: 1px solid var(--panel-shell-border);
  box-shadow:
    var(--panel-shell-shadow-1),
    var(--panel-shell-shadow-2);
  overflow: hidden;
  color: #e8e8ea;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  transform-origin: 50% 0;
  will-change: transform, opacity, border-radius;
  contain: layout paint;
  backface-visibility: hidden;
  clip-path: inset(0 round 12px);
  -webkit-mask-image: -webkit-radial-gradient(white, black);
  isolation: isolate;

  --panel-from-x: 0px;
  --panel-from-y: -280px;
  --panel-from-sx: 0.82;
  --panel-from-sy: 0.14;
  --panel-from-radius: 24px;
  --panel-close-arc: -20px;
  --panel-top-lift: 10px;
}

.panel-sheen,
.panel-vignette,
.panel-inner {
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.panel-sheen {
  background: var(--panel-sheen-bg);
  opacity: 0.9;
}

.panel-vignette {
  background: var(--panel-vignette-bg);
  opacity: var(--panel-vignette-opacity);
}

.panel-inner {
  z-index: 3;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  filter: var(--panel-root-filter, none);
}

.motion-opening {
  animation: panel-open 280ms cubic-bezier(0.165, 0.84, 0.44, 1) both;
}

.motion-hidden,
.motion-opening-ready {
  opacity: 0.92;
  border-radius: var(--panel-from-radius);
  transform: translate3d(var(--panel-from-x), calc(var(--panel-from-y) - var(--panel-top-lift)), 0)
    scale(var(--panel-from-sx), var(--panel-from-sy));
  pointer-events: none;
}

.motion-hidden {
  opacity: 0;
}

.motion-closing {
  animation: panel-close 240ms cubic-bezier(0.55, 0.055, 0.675, 0.19) both;
  pointer-events: none;
}

.motion-hidden .panel-inner,
.motion-opening-ready .panel-inner {
  opacity: 0;
}

.motion-opening .panel-inner {
  animation: panel-inner-open 170ms cubic-bezier(0.2, 0.8, 0.22, 1) 48ms both;
}

.motion-closing .panel-inner {
  opacity: 0;
}

@keyframes panel-open {
  0% {
    opacity: 0.92;
    border-radius: var(--panel-from-radius);
    transform: translate3d(var(--panel-from-x), calc(var(--panel-from-y) - var(--panel-top-lift)), 0)
      scale(var(--panel-from-sx), var(--panel-from-sy));
  }

  68% {
    opacity: 1;
    border-radius: 17px;
    transform: translate3d(
        calc(var(--panel-from-x) * 0.05),
        calc(var(--panel-from-y) * 0.05 + var(--panel-close-arc) * -0.24),
        0
      )
      scale(1.038, 1.052);
  }

  100% {
    opacity: 1;
    border-radius: 12px;
    transform: translate3d(0, 0, 0) scale(1, 1);
  }
}

@keyframes panel-close {
  0% {
    opacity: 1;
    border-radius: 12px;
    transform: translate3d(0, 0, 0) scale(1, 1);
  }

  44% {
    opacity: 1;
    border-radius: 18px;
    transform: translate3d(
        calc(var(--panel-from-x) * 0.18),
        calc(var(--panel-from-y) * 0.18 + var(--panel-close-arc) * 0.3),
        0
      )
      scale(0.972, 0.91);
  }

  100% {
    opacity: 0.18;
    border-radius: var(--panel-from-radius);
    transform: translate3d(var(--panel-from-x), calc(var(--panel-from-y) - var(--panel-top-lift)), 0)
      scale(var(--panel-from-sx), var(--panel-from-sy));
  }
}

@keyframes panel-inner-open {
  0% {
    opacity: 0;
    transform: translate3d(0, 12px, 0);
  }

  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

.panel-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: transparent;
}

.panel-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}

.nav-btn {
  display: inline-flex;
  flex: 1 1 0;
  min-width: 0;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: transparent;
  border: none;
  outline: none;
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: color 0.18s ease, background 0.18s ease;
  font-family: inherit;
  letter-spacing: 0.02em;
}

.nav-btn:hover {
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.04);
}

.nav-btn.active {
  color: var(--focus-color);
  background: transparent;
}

.nav-btn.active:hover {
  background: color-mix(in srgb, var(--focus-color) 8%, transparent);
}

.nav-icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-icon svg {
  width: 100%;
  height: 100%;
  stroke-width: 1.8;
}

.nav-label {
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .motion-opening {
    animation: panel-fade-in 120ms ease-out both;
  }

  .motion-closing {
    animation: panel-fade-out 120ms ease-in both;
  }

  @keyframes panel-fade-in {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @keyframes panel-fade-out {
    from {
      opacity: 1;
    }

    to {
      opacity: 0;
    }
  }
}
</style>
