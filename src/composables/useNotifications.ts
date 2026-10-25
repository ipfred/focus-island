import { ref, computed } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'

export type NotificationKind = 'focus-done' | 'break-done'

export interface NotificationRecord {
  id: string
  kind: NotificationKind
  title: string
  detail: string
  time: number
  read: boolean
}

const NOTIF_FILE = 'focus-island/notifications.json'
const LIMIT = 200

const records = ref<NotificationRecord[]>([])
const loaded = ref(false)
let listening = false

const unreadCount = computed(() => records.value.filter(r => !r.read).length)

const KIND_LABELS: Record<NotificationKind, { title: string; detail: string }> = {
  'focus-done': { title: '专注完成', detail: '本轮番茄结束，休息一下' },
  'break-done': { title: '休息结束', detail: '准备好开始下一轮专注了' },
}

async function load() {
  try {
    const raw = await readTextFile(NOTIF_FILE, { baseDir: BaseDirectory.AppData })
    const parsed = JSON.parse(raw) as NotificationRecord[]
    records.value = Array.isArray(parsed) ? parsed.slice(0, LIMIT) : []
  } catch {
    records.value = []
  }
  loaded.value = true
}

async function save() {
  if (!loaded.value) return
  try {
    await mkdir('focus-island', { baseDir: BaseDirectory.AppData, recursive: true })
    await writeTextFile(NOTIF_FILE, JSON.stringify(records.value), { baseDir: BaseDirectory.AppData })
  } catch (e) {
    console.error('Failed to save notifications', e)
  }
}

export function addRecord(kind: NotificationKind, detail?: string) {
  const labels = KIND_LABELS[kind]
  records.value = [
    {
      id: `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      title: labels.title,
      detail: detail || labels.detail,
      time: Date.now(),
      read: false,
    },
    ...records.value,
  ].slice(0, LIMIT)
  save()
}

function markAllRead() {
  records.value = records.value.map(r => (r.read ? r : { ...r, read: true }))
  save()
}

function clearAll() {
  records.value = []
  save()
}

export function formatNotifTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === now.toDateString()) return hm
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

export function useNotifications() {
  if (!loaded.value) load()
  if (!listening) {
    listening = true
    // 面板端番茄钟推送的横幅事件，同步记录到通知中心
    void listen<'focus-done' | 'break-done' | null>('notification-show', ({ payload }) => {
      if (payload === 'focus-done' || payload === 'break-done') {
        addRecord(payload)
      }
    })
  }
  return { records, unreadCount, markAllRead, clearAll }
}
