import { watch, onUnmounted } from 'vue'
import { register, unregister } from '@tauri-apps/plugin-global-shortcut'
import { invoke } from '@tauri-apps/api/core'
import { useSettings } from './useSettings'

let currentShortcut = ''

export function useShortcut() {
  const { settings } = useSettings()

  async function applyShortcut(key: string) {
    if (currentShortcut && currentShortcut !== key) {
      try { await unregister(currentShortcut) } catch { /* ok */ }
    }
    if (!key) {
      currentShortcut = ''
      return
    }
    try {
      await register(key, (event) => {
        // The handler fires on both press and release.
        if (event.state !== 'Pressed') return
        invoke('toggle_panel')
      })
      currentShortcut = key
    } catch (e) {
      console.error('Failed to register shortcut:', key, e)
    }
  }

  const stopWatch = watch(
    () => settings.value.shortcutKey,
    (val) => { applyShortcut(val ?? '') },
    { immediate: true },
  )

  onUnmounted(async () => {
    stopWatch()
    if (currentShortcut) {
      try { await unregister(currentShortcut) } catch { /* ok */ }
      currentShortcut = ''
    }
  })

  return { applyShortcut }
}
