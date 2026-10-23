import { ref, computed, watch } from 'vue'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { emit } from '@tauri-apps/api/event'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'

export type StationIcon = 'code' | 'wave' | 'drone' | 'planet' | 'star' | 'pill' | 'folder' | 'coffee' | 'jazz' | 'spy' | 'hacker' | 'link'

export type StationCategory = 'focus' | 'ambient' | 'lofi' | 'jazz' | 'custom'

export interface RadioStation {
  id: string
  name: string
  streamUrl: string
  description: string
  icon: StationIcon
  keyword: string
  category: StationCategory
  tags: string[]
  /** 原始链接（视频/歌单条目），播放时经 yt-dlp 解析成纯音频流 */
  sourceUrl?: string
  /** 备用流地址：主地址失败时依次切换（多为 302 降级 / 节点故障的官方电台） */
  fallbackUrls?: string[]
}

export interface RadioSettings {
  currentStationId: string | null
  volume: number
  customStations?: RadioStation[]
}

export interface MediaEntry {
  title: string
  url: string
}

export const CATEGORY_LABELS: Record<StationCategory, string> = {
  focus: '编程 / 专注',
  ambient: '氛围 / 冥想',
  lofi: 'Lo-Fi / 轻松',
  jazz: '爵士 / 古典',
  custom: '我的导入',
}

export const PRESET_STATIONS: RadioStation[] = [
  // 编程 / 专注
  {
    id: 'coderadio',
    name: 'Code Radio',
    streamUrl: 'https://coderadio.stream.laut.fm/coderadio',
    description: 'freeCodeCamp 24h 编程音乐电台',
    icon: 'code',
    keyword: '编程',
    category: 'focus',
    tags: ['编程', '专注', '无人声'],
  },
  {
    id: 'instrumental',
    name: 'Instrumental FM',
    streamUrl: 'https://stream.laut.fm/instrumental',
    description: '纯器乐流行，无人声干扰，适合敲代码',
    icon: 'hacker',
    keyword: '器乐',
    category: 'focus',
    tags: ['器乐', '无人声', '编程'],
  },
  {
    id: 'radioparadise',
    name: 'Radio Paradise',
    streamUrl: 'https://stream.radioparadise.com/mp3-192',
    description: '多元化精选电台，工作学习万能伴流',
    icon: 'wave',
    keyword: '精选',
    category: 'focus',
    tags: ['精选', '多元', '办公'],
  },
  // 氛围 / 冥想
  {
    id: 'scenichd',
    name: 'Scenic HD',
    streamUrl: 'https://radio.stereoscenic.com/asp-h',
    description: '高保真立体声景，极简无节拍，深度专注',
    icon: 'drone',
    keyword: '声景',
    category: 'ambient',
    tags: ['氛围', '冥想', '无节拍'],
  },
  {
    id: 'paradisemellow',
    name: 'Paradise Mellow',
    streamUrl: 'https://stream.radioparadise.com/mellow-128',
    description: '温柔旋律混合，安静陪伴不抢戏',
    icon: 'planet',
    keyword: '温柔',
    category: 'ambient',
    tags: ['轻柔', '陪伴', '专注'],
  },
  {
    id: 'cityfm',
    name: 'City Vibes',
    streamUrl: 'https://stream.laut.fm/city',
    description: '都会律动电台，中速节奏轻松聚焦',
    icon: 'star',
    keyword: '都会',
    category: 'ambient',
    tags: ['律动', '轻松', '专注'],
  },
  {
    id: 'ambientpill',
    name: 'Ambient Pill',
    streamUrl: 'https://radio.stereoscenic.com/asp-s',
    description: '24h 纯氛围音乐，无节拍无广告',
    icon: 'pill',
    keyword: '纯氛围',
    category: 'ambient',
    tags: ['氛围', '无广告', '24h'],
  },
  // Lo-Fi / 轻松
  {
    id: 'lofi',
    name: 'Lo-Fi Hip Hop',
    streamUrl: 'https://lofi.stream.laut.fm/lofi',
    description: '经典 Lofi 纯音乐，轻微鼓点，复古怀旧',
    icon: 'coffee',
    keyword: 'Lofi',
    category: 'lofi',
    tags: ['Lofi', '学习', '放松'],
  },
  {
    id: 'chillout',
    name: 'Chillout Lounge',
    streamUrl: 'https://chillout.stream.laut.fm/chillout',
    description: '沙发音乐，适合下午茶或轻松事务',
    icon: 'coffee',
    keyword: '沙发',
    category: 'lofi',
    tags: ['放松', '沙发', '下午茶'],
  },
  // 爵士 / 古典
  {
    id: 'lautjazz',
    name: 'Laut Jazz',
    streamUrl: 'https://jazz.stream.laut.fm/jazz',
    description: '全天候爵士流，柔和乐器，适合阅读写作',
    icon: 'jazz',
    keyword: '爵士',
    category: 'jazz',
    tags: ['爵士', '乐器', '写作'],
  },
  {
    id: 'swissjazz',
    name: 'Radio Swiss Jazz',
    streamUrl: 'https://livestreaming-node-1.srg-ssr.ch/srgssr/rsj/mp3/128',
    // 上游 /m/rsj/mp3_128 会 302 到 http，WebView 里容易失败；直连 https 节点
    fallbackUrls: ['https://stream.srg-ssr.ch/m/rsj/mp3_128'],
    description: '瑞士爵士电台，传统爵士，无广告',
    icon: 'jazz',
    keyword: '传统',
    category: 'jazz',
    tags: ['爵士', '传统', '无广告'],
  },
  {
    id: 'deluxefm',
    name: 'Deluxe FM',
    streamUrl: 'https://stream.laut.fm/deluxe',
    description: '精致休闲精选，下午茶与轻松事务',
    icon: 'spy',
    keyword: '精致',
    category: 'lofi',
    tags: ['休闲', '精选', '轻松'],
  },
  // 本地音乐
  {
    id: 'local-music',
    name: '本地音乐',
    streamUrl: '__LOCAL__',
    description: '离线专注音乐（数据目录 music/focus-music.mp3）',
    icon: 'folder',
    keyword: '离线',
    category: 'focus',
    tags: ['本地', '离线', '自定义'],
  },
]

const RADIO_FILE = 'focus-island/radio.json'

const DEFAULT_RADIO_SETTINGS: RadioSettings = {
  currentStationId: null,
  volume: 50,
  customStations: [],
}

const radioSettings = ref<RadioSettings>({ ...DEFAULT_RADIO_SETTINGS })
const customStations = ref<RadioStation[]>([])
const playing = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const loaded = ref(false)

const allStations = computed(() => [...PRESET_STATIONS, ...customStations.value])

const currentStation = computed(() =>
  allStations.value.find(s => s.id === radioSettings.value.currentStationId) ?? null
)

/** 解析结果缓存：sourceUrl → { stream, at }，1 小时内复用（直链常带时效签名） */
const resolvedCache = new Map<string, { stream: string; at: number }>()
const RESOLVE_TTL = 60 * 60 * 1000

const AUDIO_URL_RE = /\.(mp3|m4a|aac|ogg|opus|wav|flac)(\?|#|$)/i
const M3U_URL_RE = /\.m3u8?(\?|#|$)/i

function stationId(prefix: string): string {
  return `custom-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function makeCustomStation(title: string, url: string): RadioStation {
  return {
    id: stationId('s'),
    name: title,
    streamUrl: '__RESOLVE__',
    sourceUrl: url,
    description: hostOf(url),
    icon: 'link',
    keyword: '导入',
    category: 'custom',
    tags: ['导入'],
  }
}

/** 解析 M3U/M3U8 文本 → 音频直链电台 */
function parseM3U(text: string): RadioStation[] {
  const out: RadioStation[] = []
  let pendingTitle = ''
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (line.toUpperCase().startsWith('#EXTINF')) {
      pendingTitle = line.split(',').slice(1).join(',').trim()
    } else if (line.startsWith('#')) {
      continue
    } else if (/^https?:\/\//i.test(line)) {
      const name = pendingTitle || hostOf(line)
      if (AUDIO_URL_RE.test(line) || /\.m3u8?(\?|#|$)/i.test(line)) {
        out.push({
          id: stationId('m'),
          name,
          streamUrl: line,
          description: hostOf(line),
          icon: 'link',
          keyword: '导入',
          category: 'custom',
          tags: ['M3U'],
        })
      }
      pendingTitle = ''
    }
  }
  return out
}

/** 解析 PLS 文本 → 音频直链电台 */
function parsePLS(text: string): RadioStation[] {
  const files = new Map<number, string>()
  const titles = new Map<number, string>()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const fileMatch = /^File(\d+)\s*=\s*(.+)$/i.exec(line)
    if (fileMatch) files.set(Number(fileMatch[1]), fileMatch[2].trim())
    const titleMatch = /^Title(\d+)\s*=\s*(.+)$/i.exec(line)
    if (titleMatch) titles.set(Number(titleMatch[1]), titleMatch[2].trim())
  }
  const out: RadioStation[] = []
  for (const [idx, url] of files) {
    if (!/^https?:\/\//i.test(url)) continue
    out.push({
      id: stationId('p'),
      name: titles.get(idx) || hostOf(url),
      streamUrl: url,
      description: hostOf(url),
      icon: 'link',
      keyword: '导入',
      category: 'custom',
      tags: ['PLS'],
    })
  }
  return out
}

async function addCustomStations(stations: RadioStation[]): Promise<number> {
  const known = new Set(customStations.value.map(s => s.sourceUrl || s.streamUrl))
  const fresh = stations.filter(s => !known.has(s.sourceUrl || s.streamUrl))
  if (fresh.length) {
    customStations.value = [...customStations.value, ...fresh]
    if (customStations.value.length > 500) {
      customStations.value = customStations.value.slice(-500)
    }
  }
  return fresh.length
}

function renameCustomStation(id: string, name: string) {
  const name2 = name.trim()
  if (!name2) return
  customStations.value = customStations.value.map(s => (s.id === id ? { ...s, name: name2 } : s))
}

function removeCustomStation(id: string) {
  customStations.value = customStations.value.filter(s => s.id !== id)
  if (radioSettings.value.currentStationId === id) {
    pause()
    radioSettings.value.currentStationId = null
  }
}

/**
 * 导入链接：自动识别 音频直链 / M3U 歌单 / 视频·合集链接（yt-dlp）。
 * 返回新增条数。
 */
async function importFromUrl(rawUrl: string): Promise<number> {
  const url = rawUrl.trim()
  if (!url) throw new Error('链接为空')

  if (M3U_URL_RE.test(url)) {
    const text = await invoke<string>('http_get_text', { url })
    const added = await addCustomStations(parseM3U(text))
    if (!added) throw new Error('歌单里没有可播放的音频条目')
    return added
  }

  if (AUDIO_URL_RE.test(url)) {
    return addCustomStations([makeCustomStation(decodeURIComponent(url.split('/').pop() || '音频直链'), url)])
  }

  try {
    const entries = await invoke<MediaEntry[]>('import_media_entries', { url })
    return addCustomStations(
      entries.map(e => makeCustomStation(e.title, e.url || url)),
    )
  } catch (e) {
    const msg = typeof e === 'string' ? e : '解析失败'
    if (msg === 'YT_NOT_INSTALLED') {
      // 首次使用：自动下载 yt-dlp 后重试
      await invoke<string>('ensure_ytdlp')
      const entries = await invoke<MediaEntry[]>('import_media_entries', { url })
      return addCustomStations(
        entries.map(e => makeCustomStation(e.title, e.url || url)),
      )
    }
    throw new Error(msg)
  }
}

/** 导入本地歌单文件（.m3u/.m3u8/.pls/.txt） */
async function importFromFile(file: File): Promise<number> {
  const text = await file.text()
  const stations = /\.pls(\?|#|$)/i.test(file.name) ? parsePLS(text) : parseM3U(text)
  if (!stations.length) throw new Error('歌单里没有可播放的音频条目')
  return addCustomStations(stations)
}

const volume = computed(() => radioSettings.value.volume)

// ---- Module-level Audio singleton ----

let audio: HTMLAudioElement | null = null

// 断流自愈：官方直播源经常 302 降级、节点抖动或直接掐断，
// 这里按「备用地址 → 退避重试」顺序恢复，避免整段专注音乐直接静音。
const RETRY_DELAYS = [1200, 3200, 7000]

let srcCandidates: string[] = []
let candidateIndex = 0
let expectedSrc = ''
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryCount = 0
let userPaused = false

function clearRetry() {
  if (retryTimer !== null) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

function mediaErrorMessage(): string {
  const err = audio?.error
  if (!err) return '音频播放错误'
  switch (err.code) {
    case MediaError.MEDIA_ERR_NETWORK:
      return '网络错误，无法加载音频流'
    case MediaError.MEDIA_ERR_DECODE:
      return '音频解码失败'
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return '不支持的音频格式'
    default:
      return '音频播放错误'
  }
}

async function loadAndPlay(url: string) {
  const a = getAudio()
  expectedSrc = url
  a.src = url
  a.load()
  a.volume = radioSettings.value.volume / 100
  try {
    await a.play()
  } catch {
    // 部分失败不会派发 error 事件，这里兜底推进到下一个候选
    handleStreamFailure()
  }
}

function handleStreamFailure(reason: 'error' | 'ended' = 'error') {
  const station = currentStation.value
  const isLive = /^https?:/i.test(expectedSrc)
  if (!isLive) {
    // 本地文件 / 本地下载音频：播完就停，失败才提示
    loading.value = false
    if (reason === 'error') error.value = mediaErrorMessage()
    return
  }
  if (userPaused || !station) {
    loading.value = false
    return
  }
  // 1) 先试备用地址
  if (candidateIndex + 1 < srcCandidates.length) {
    candidateIndex += 1
    error.value = null
    loading.value = true
    void loadAndPlay(srcCandidates[candidateIndex])
    return
  }
  // 2) 再按退避重试主地址
  if (retryTimer !== null) return
  if (retryCount >= RETRY_DELAYS.length) {
    loading.value = false
    error.value = '音频流多次中断，点击播放可重连'
    return
  }
  const delay = RETRY_DELAYS[retryCount]
  retryCount += 1
  error.value = null
  loading.value = true
  retryTimer = setTimeout(() => {
    retryTimer = null
    candidateIndex = 0
    void loadAndPlay(srcCandidates[0] ?? expectedSrc)
  }, delay)
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'auto'

    audio.addEventListener('playing', () => {
      playing.value = true
      loading.value = false
      error.value = null
      retryCount = 0
    })
    audio.addEventListener('pause', () => {
      // Only set false if it wasn't paused due to buffering
      if (!audio!.seeking && audio!.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        playing.value = false
      }
      loading.value = false
    })
    audio.addEventListener('ended', () => {
      playing.value = false
      loading.value = false
      // 直播流"结束"意味着被掐断，自动重连；本地文件播完则保持停止
      handleStreamFailure('ended')
    })
    audio.addEventListener('error', () => {
      playing.value = false
      loading.value = false
      handleStreamFailure()
    })
    audio.addEventListener('waiting', () => { loading.value = true })
    audio.addEventListener('canplay', () => { loading.value = false })
    audio.addEventListener('canplaythrough', () => { loading.value = false })
  }
  return audio
}

// ---- Persistence ----

async function loadSettings() {
  try {
    const raw = await readTextFile(RADIO_FILE, { baseDir: BaseDirectory.AppData })
    const parsed = JSON.parse(raw) as Partial<RadioSettings>
    radioSettings.value = {
      ...DEFAULT_RADIO_SETTINGS,
      ...parsed,
      volume: Math.max(0, Math.min(100, parsed.volume ?? DEFAULT_RADIO_SETTINGS.volume)),
    }
    customStations.value = Array.isArray(parsed.customStations) ? parsed.customStations : []
  } catch {
    radioSettings.value = { ...DEFAULT_RADIO_SETTINGS }
    customStations.value = []
  }
  loaded.value = true
}

async function save() {
  if (!loaded.value) return
  try {
    await mkdir('focus-island', { baseDir: BaseDirectory.AppData, recursive: true })
    const payload: RadioSettings = { ...radioSettings.value, customStations: customStations.value }
    await writeTextFile(RADIO_FILE, JSON.stringify(payload), { baseDir: BaseDirectory.AppData })
  } catch (e) {
    console.error('Failed to save radio settings', e)
  }
}

watch([radioSettings, customStations], () => {
  save()
  emit('radio-state-update', {
    playing: playing.value,
    stationId: radioSettings.value.currentStationId,
  })
}, { deep: true })

watch(playing, () => {
  emit('radio-state-update', {
    playing: playing.value,
    stationId: radioSettings.value.currentStationId,
  })
})

// ---- Playback controls ----

async function play(stationId?: string) {
  const id = stationId ?? radioSettings.value.currentStationId
  if (!id) {
    radioSettings.value.currentStationId = PRESET_STATIONS[0]?.id ?? null
    if (!radioSettings.value.currentStationId) return
  } else if (id !== radioSettings.value.currentStationId) {
    radioSettings.value.currentStationId = id
  }
  const station = allStations.value.find(s => s.id === radioSettings.value.currentStationId)
  if (!station) return

  loading.value = true
  error.value = null
  userPaused = false
  retryCount = 0
  clearRetry()

  try {
    let src: string
    if (station.streamUrl === '__LOCAL__') {
      try {
        const filePath = await invoke<string>('get_local_audio_path')
        src = convertFileSrc(filePath)
      } catch (e) {
        error.value = typeof e === 'string' ? e : '本地音频文件不存在'
        loading.value = false
        return
      }
    } else if (station.streamUrl === '__RESOLVE__' && station.sourceUrl) {
      // B 站源有防盗链（CDN 校验 Referer，<audio> 直连会被 403）：
      // 直接用 yt-dlp 下载音频到临时目录后本地播放
      if (/bilibili\.com|b23\.tv/i.test(station.sourceUrl)) {
        try {
          const filePath = await invoke<string>('download_temp_audio', { url: station.sourceUrl })
          src = convertFileSrc(filePath)
        } catch (e2) {
          const msg = typeof e2 === 'string' ? e2 : '下载失败'
          error.value = msg === 'YT_NOT_INSTALLED' ? '需要 yt-dlp：将自动下载' : msg
          loading.value = false
          return
        }
      } else {
        const cached = resolvedCache.get(station.sourceUrl)
      if (cached && Date.now() - cached.at < RESOLVE_TTL) {
        src = cached.stream
      } else {
        try {
          const res = await invoke<{ stream_url: string; title: string | null }>('resolve_audio_url', {
            url: station.sourceUrl,
          })
          src = res.stream_url
          resolvedCache.set(station.sourceUrl, { stream: src, at: Date.now() })
        } catch (e) {
          const msg = typeof e === 'string' ? e : '解析失败'
          if (msg === 'YT_NOT_INSTALLED') {
            // 首次使用：自动下载 yt-dlp（约 17MB），完成后重试一次
            loading.value = true
            try {
              await invoke<string>('ensure_ytdlp')
              const res = await invoke<{ stream_url: string; title: string | null }>('resolve_audio_url', {
                url: station.sourceUrl,
              })
              src = res.stream_url
              resolvedCache.set(station.sourceUrl, { stream: src, at: Date.now() })
            } catch (e2) {
              error.value = typeof e2 === 'string' ? e2 : 'yt-dlp 获取失败'
              loading.value = false
              return
            }
          } else {
            error.value = msg
            loading.value = false
            return
          }
        }
      }
      }
    } else {
      src = station.streamUrl
    }

    // 候选地址：主地址 + 备用镜像（仅直链有效；本地文件/yt-dlp 结果不参与重连）
    srcCandidates = [src, ...(station.fallbackUrls ?? [])]
    candidateIndex = 0
    await loadAndPlay(src)
  } catch (e) {
    playing.value = false
    error.value = typeof e === 'string' ? e : '播放失败'
    loading.value = false
  }
}

async function pause() {
  userPaused = true
  clearRetry()
  retryCount = 0
  const a = getAudio()
  a.pause()
  playing.value = false
  loading.value = false
}

async function toggle() {
  if (playing.value || loading.value) {
    pause()
  } else {
    const a = getAudio()
    userPaused = false
    // If we already have a source loaded, try to resume (only if there was no error)
    if (radioSettings.value.currentStationId && a.src && a.src !== window.location.href && !error.value) {
      try {
        await a.play()
      } catch {
        // Resume failed, do a fresh play
        await play()
      }
    } else {
      await play()
    }
  }
}

async function switchStation(id: string) {
  if (id === radioSettings.value.currentStationId && playing.value) return
  await play(id)
}

async function setVolume(v: number) {
  const clamped = Math.max(0, Math.min(100, v))
  radioSettings.value.volume = clamped
  getAudio().volume = clamped / 100
}

export function useRadio() {
  if (!loaded.value) loadSettings()

  return {
    stations: allStations,
    customStations,
    currentStation,
    playing,
    loading,
    error,
    volume,
    play,
    pause,
    toggle,
    switchStation,
    setVolume,
    importFromUrl,
    importFromFile,
    removeCustomStation,
    renameCustomStation,
  }
}
