import { ref, computed, watch } from 'vue'
import { useIdle } from '@vueuse/core'

export type IslandState = 'idle' | 'focus' | 'break' | 'hide' | 'alert'

const state = ref<IslandState>('idle')
const prevState = ref<IslandState>('idle')
const interacting = ref(false)
const notificationVisible = ref(false)

export function useIslandState() {
  const { idle } = useIdle(5 * 60 * 1000) // 5 minutes

  watch(idle, (isIdle) => {
    if (notificationVisible.value) return // don't override during notification
    if (isIdle && state.value === 'idle') {
      prevState.value = state.value
      state.value = 'alert'
    } else if (!isIdle && state.value === 'alert') {
      state.value = prevState.value
    }
  })

  function setState(s: IslandState) {
    if (notificationVisible.value) return // don't override during notification
    if (state.value !== 'hide') prevState.value = state.value
    state.value = s
  }

  function setInteracting(v: boolean) {
    interacting.value = v
    if (notificationVisible.value) return // don't override during notification
    if (v && state.value === 'hide') {
      state.value = prevState.value
    }
  }

  function setNotificationVisible(v: boolean) {
    notificationVisible.value = v
  }

  const isHidden = computed(() => state.value === 'hide')
  const isAlert = computed(() => state.value === 'alert')

  return { state, notificationVisible, setState, setInteracting, setNotificationVisible, isHidden, isAlert }
}
