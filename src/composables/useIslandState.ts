import { ref, computed, watch } from 'vue'
import { useMouse, useIdle } from '@vueuse/core'
import { invoke } from '@tauri-apps/api/core'

export type IslandState = 'idle' | 'focus' | 'break' | 'hide' | 'alert'

const state = ref<IslandState>('idle')
const prevState = ref<IslandState>('idle')

// Whether the user is interacting with UI (task list, context menu)
const interacting = ref(false)

// Thresholds: how far (in client Y) from the island to trigger hide/restore
const HIDE_Y = 60       // mouse within 60px of island top → hide
const RESTORE_Y = 120   // mouse beyond 120px from island bottom → restore

export function useIslandState() {
  const { y: mouseY } = useMouse({ type: 'client' })
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

  // Proximity detection using client Y coordinate
  // The island sits at the top of the window. When the mouse enters the
  // upper zone of the window (near the island), it means the user is
  // reaching for browser tabs etc. → hide the island.
  watch(mouseY, async (my) => {
    if (state.value === 'alert' || interacting.value) return

    try {
      if (state.value !== 'hide' && my >= 0 && my < HIDE_Y) {
        prevState.value = state.value
        state.value = 'hide'
        await invoke('set_click_through', { ignore: true })
      } else if (state.value === 'hide' && my > RESTORE_Y) {
        state.value = prevState.value
        await invoke('set_click_through', { ignore: false })
      }
    } catch {
      // not in tauri context (browser dev)
    }
  })

  function setState(s: IslandState) {
    if (state.value !== 'hide') prevState.value = state.value
    state.value = s
  }

  function setInteracting(v: boolean) {
    interacting.value = v
    // Restore from hide if user starts interacting
    if (v && state.value === 'hide') {
      state.value = prevState.value
      invoke('set_click_through', { ignore: false }).catch(() => {})
    }
  }

  const isHidden = computed(() => state.value === 'hide')
  const isAlert = computed(() => state.value === 'alert')

  return { state, setState, setInteracting, isHidden, isAlert }
}
