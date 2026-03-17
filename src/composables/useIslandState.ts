import { ref, computed, watch } from 'vue'
import { useMouse, useIdle } from '@vueuse/core'

export type IslandState = 'idle' | 'focus' | 'break' | 'hide' | 'alert'

const state = ref<IslandState>('idle')
const prevState = ref<IslandState>('idle')

// Whether the user is interacting with UI (task list, context menu)
const interacting = ref(false)

// Proximity thresholds in client Y pixels
const HIDE_Y = 50       // mouse in top 50px of window → hide
const RESTORE_Y = 100   // mouse beyond 100px → restore

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

  // Proximity detection: purely visual hide (no click-through)
  // When the mouse enters the top zone of the window, the island shrinks
  // to a 2px line. When the mouse moves away, it restores.
  watch(mouseY, (my) => {
    if (state.value === 'alert' || interacting.value) return

    if (state.value !== 'hide' && my >= 0 && my < HIDE_Y) {
      prevState.value = state.value
      state.value = 'hide'
    } else if (state.value === 'hide' && my > RESTORE_Y) {
      state.value = prevState.value
    }
  })

  function setState(s: IslandState) {
    if (state.value !== 'hide') prevState.value = state.value
    state.value = s
  }

  function setInteracting(v: boolean) {
    interacting.value = v
    if (v && state.value === 'hide') {
      state.value = prevState.value
    }
  }

  const isHidden = computed(() => state.value === 'hide')
  const isAlert = computed(() => state.value === 'alert')

  return { state, setState, setInteracting, isHidden, isAlert }
}
