import { ref, computed, watch, watchEffect } from 'vue'
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
  const hiddenMode = computed(() => settings.value.islandDisplayMode === 'hidden')
  // 常驻模式同样需要输入轮询：舞台永远点击穿透，点击只能靠 Rust 判定
  const interactiveMode = computed(() => !hiddenMode.value)

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
      if (!interactiveMode.value || forceExpanded.value) {
        if (dockExpanded.value && !forceExpanded.value) dockExpanded.value = false
        return
      }
      try {
        const input = await invoke<{ over: boolean; clicked: boolean }>('poll_island_input', { pad: 2 })
        // 点击刘海/胶囊打开面板（可在设置中关闭，仅快捷键/托盘）
        if (input.clicked && !panelVisible.value && settings.value.notchClickOpensPanel) {
          void invoke('toggle_panel')
          return
        }
        // 悬停展开只属于边缘停靠模式；常驻胶囊始终完整显示
        if (!dockMode.value) return
        const over = input.over
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

  // Start/stop polling based on whether the island is interactive (resident or dock)
  if (!watchInstalled) {
    watchInstalled = true
    watch(
      interactiveMode,
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

  // Track panel visibility: poll the source of truth each tick (events can be missed),
  // keep the event listener for instant updates.
  if (!panelListenerInstalled) {
    panelListenerInstalled = true
    invoke<boolean>('is_panel_visible').then((v) => { panelVisible.value = v }).catch(() => {})
    listen<string>('island-panel-motion', ({ payload }) => {
      if (payload === 'open') panelVisible.value = true
      else if (payload === 'close') panelVisible.value = false
    }).catch(() => {})
  }

  watchEffect(() => {
    if (!dockMode.value) return
    invoke<boolean>('is_panel_visible').then((v) => { panelVisible.value = v }).catch(() => {})
  })

  // 舞台永远点击穿透（点击由输入轮询判定）；仅通知横幅需要接收点击
  // 注意：ignore=true 才是"忽略鼠标=穿透"，无通知时必须为 true，否则整块 500x160 舞台会吃掉点击
  watchEffect(() => {
    if (!dockMode.value) return
    void invoke('set_click_through', { ignore: !notificationVisible.value })
  })

  // 完全隐藏模式：灵动岛窗口整体隐藏（面板仍可通过快捷键/托盘打开）
  watchEffect(() => {
    void invoke('set_island_visible', { visible: !hiddenMode.value })
  })

  return {
    dockMode,
    hiddenMode,
    dockExpanded,
    dockCollapsed,
    forceExpanded,
    stripProgress,
    stripColor,
    DOCK_STRIP_WINDOW_H,
  }
}
