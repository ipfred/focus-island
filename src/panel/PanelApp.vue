<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useTimerBridge } from '../composables/useTimerBridge'
import { useSettings } from '../composables/useSettings'
import TaskArea from './TaskArea.vue'
import SettingsPage from './SettingsPage.vue'
import CompletedPage from './CompletedPage.vue'
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

const currentView = ref<'tasks' | 'settings' | 'completed'>('tasks')
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
    try {
      await getCurrentWindow().setFocus()
    } catch {
      // ignore focus errors during animation completion
    }
    return
  }

  if (event.animationName === 'panel-close' && panelAnimState.value === 'closing') {
    void finishCloseAnimation()
  }
}

onMounted(async () => {
  startBridge()
  await invoke('set_click_through', { ignore: false })

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
      <PanelTitleBar @close="closeWindow" />
      <div class="panel-body">
        <transition name="slide-right" mode="out-in">
          <TaskArea v-if="currentView === 'tasks'" category="today" @close="closeWindow" @settings="currentView = 'settings'" @completed="currentView = 'completed'" />
          <SettingsPage v-else-if="currentView === 'settings'" @back="currentView = 'tasks'" />
          <CompletedPage v-else @back="currentView = 'tasks'" />
        </transition>
      </div>
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
    linear-gradient(180deg, rgba(22, 22, 27, 0.985), rgba(18, 18, 22, 0.97)),
    #121216;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.34),
    0 6px 18px rgba(0, 0, 0, 0.22);
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
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 22%),
    radial-gradient(circle at 50% 0, rgba(255, 255, 255, 0.12), transparent 46%);
  opacity: 0.9;
}

.panel-vignette {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.14));
  opacity: 0.8;
}

.panel-inner {
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
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
