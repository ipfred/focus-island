import { ref, computed, watch } from 'vue'
import { useMouse, useIdle } from '@vueuse/core'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export type IslandState = 'idle' | 'focus' | 'break' | 'hide' | 'alert'

const state = ref<IslandState>('idle')
const prevState = ref<IslandState>('idle')

// Proximity detection thresholds (px)
const HIDE_THRESHOLD = 200
const RESTORE_THRESHOLD = 320

export function useIslandState() {
  const { x: mouseX, y: mouseY } = useMouse({ type: 'client' })
  const { idle } = useIdle(5 * 60 * 1000) // 5 minutes

  // Watch idle for alert state
  watch(idle, (isIdle) => {
    if (isIdle && (state.value === 'focus' || state.value === 'idle')) {
      prevState.value = state.value
      state.value = 'alert'
    } else if (!isIdle && state.value === 'alert') {
      state.value = prevState.value
    }
  })

  // Proximity detection - compare mouse position to window position on screen
  watch([mouseX, mouseY], async ([mx, my]) => {
    if (state.value === 'alert') return

    try {
      const win = getCurrentWindow()
      const pos = await win.outerPosition()
      const size = await win.outerSize()
      const sf = await win.scaleFactor()
      const scaleFactor = typeof sf === 'number' ? sf : 1

      const wx = pos.x / scaleFactor
      const wy = pos.y / scaleFactor
      const ww = size.width / scaleFactor
      const wh = size.height / scaleFactor

      const cx = Math.max(wx, Math.min(wx + ww, mx))
      const cy = Math.max(wy, Math.min(wy + wh, my))
      const dist = Math.hypot(mx - cx, my - cy)

      if (state.value !== 'hide' && dist < HIDE_THRESHOLD) {
        prevState.value = state.value
        state.value = 'hide'
        await invoke('set_click_through', { ignore: true })
      } else if (state.value === 'hide' && dist > RESTORE_THRESHOLD) {
        state.value = prevState.value
        await invoke('set_click_through', { ignore: false })
      }
    } catch {
      // not in tauri context (dev)
    }
  })

  function setState(s: IslandState) {
    if (state.value !== 'hide') prevState.value = state.value
    state.value = s
  }

  const isHidden = computed(() => state.value === 'hide')
  const isAlert = computed(() => state.value === 'alert')

  return { state, setState, isHidden, isAlert }
}
