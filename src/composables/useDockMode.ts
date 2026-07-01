import { ref, computed, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useSettings } from './useSettings'
import { useIslandState } from './useIslandState'
import { useTimer } from './useTimer'

// Collapsed strip window height (logical px). The visible bar is thinner inside.
export const DOCK_STRIP_WINDOW_H = 14

const dockExpanded = ref(false)
const panelVisible = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null
let collapseTimer: ReturnType<typeof setTimeout> | null = null
let watchInstalled = false
let panelListenerInstalled = false

export function useDockMode() {
  const { settings } = useSettings()
  const { state, notificationVisible } = useIslandState()
  const timer = useTimer()

  const dockMode = computed(() => settings.value.islandDisplayMode === 'dock')

  // During notifications / idle-alert / panel-open, always show the full capsule.
  const forceExpanded = computed(
    () => notificationVisible.value || state.value === 'alert' || panelVisible.value
  )

  const dockCollapsed = computed(
    () => dockMode.value && !dockExpanded.value && !forceExpanded.value
  )

  const stripProgress = computed(() => {
    if (state.value !== 'focus' && state.value !== 'break') return 0
    const v = timer.progress.value
    if (!Number.isFinite(v) || v <= 0) return 0
    return v >= 1 ? 1 : v
  })

  const stripColor = computed(() => {
    if (state.value === 'focus') return 'var(--focus-color)'
    if (state.value === 'break') return 'var(--break-color)'
    return 'var(--idle-color)'
  })

  function ensurePolling() {
    if (pollTimer !== null) return
    pollTimer = setInterval(async () => {
      if (!dockMode.value || forceExpanded.value) {
        if (dockExpanded.value && !forceExpanded.value) dockExpanded.value = false
        return
      }
      try {
        const over = await invoke<boolean>('is_mouse_over_window', { pad: 2 })
        if (over) {
          if (collapseTimer !== null) {
            clearTimeout(collapseTimer)
            collapseTimer = null
          }
          if (!dockExpanded.value) dockExpanded.value = true
        } else if (dockExpanded.value && collapseTimer === null) {
          collapseTimer = setTimeout(() => {
            dockExpanded.value = false
            collapseTimer = null
          }, 350)
        }
      } catch {
        // command unavailable; ignore
      }
    }, 120)
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (collapseTimer !== null) {
      clearTimeout(collapseTimer)
      collapseTimer = null
    }
  }

  // Start/stop polling once for the app lifetime based on dock mode.
  if (!watchInstalled) {
    watchInstalled = true
    watch(
      dockMode,
      (on) => {
        if (on) ensurePolling()
        else {
          stopPolling()
          dockExpanded.value = false
        }
      },
      { immediate: true }
    )
  }

  // Track panel visibility: dock mode only applies when panel is closed.
  if (!panelListenerInstalled) {
    panelListenerInstalled = true
    invoke<boolean>('is_panel_visible').then((v) => { panelVisible.value = v }).catch(() => {})
    listen<string>('island-panel-motion', ({ payload }) => {
      if (payload === 'open') panelVisible.value = true
      else if (payload === 'close') panelVisible.value = false
    }).catch(() => {})
  }

  return {
    dockMode,
    dockExpanded,
    dockCollapsed,
    forceExpanded,
    stripProgress,
    stripColor,
    DOCK_STRIP_WINDOW_H,
  }
}
