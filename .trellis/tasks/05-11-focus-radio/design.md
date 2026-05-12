# 专注电台 - 技术设计

## 核心架构

### 数据模型

```ts
interface RadioStation {
  id: string
  name: string
  streamUrl: string
  description: string
}

interface RadioSettings {
  currentStationId: string | null
  volume: number  // 0-100
}
```

预设电台列表硬编码在 composable 中，RadioSettings 持久化到 `$APPDATA/focus-island/radio.json`。

### 模块结构

```
src/composables/useRadio.ts    — 核心逻辑（Audio 控制 + 状态管理 + 持久化）
src/panel/RadioPage.vue        — Panel 电台视图页
src/components/Island.vue       — 接收电台状态，传递给子组件
src/components/CapsuleIdle.vue  — 空闲态显示音符图标
src/components/CapsuleFocus.vue — 专注态显示音符图标
```

## 数据流

```
Panel 窗口                          Island 窗口
┌─────────────┐    radio-state-update    ┌──────────────┐
│ useRadio.ts │ ────────────────────────→│ Island.vue   │
│ (Audio 元素) │  emit (Tauri event)     │ (listen)     │
│ (播放控制)   │                         │  ↓            │
│ (持久化)     │                         │ Capsule*.vue │
└─────────────┘                         │ (音符图标)    │
                                        └──────────────┘
```

- Audio 元素在 panel 窗口创建和管理
- panel 窗口通过 `emit('radio-state-update')` 广播电台状态
- island 窗口通过 `listen('radio-state-update')` 接收，驱动音符图标显隐

## useRadio.ts 设计

### 职责

1. 管理预设电台列表
2. 创建和管理 HTML5 Audio 元素
3. 播放/暂停/切换电台/音量控制
4. 持久化 RadioSettings 到磁盘
5. 广播电台状态到 island 窗口

### 关键实现

- 模块级单例 ref（与 useSettings/useTasks 一致）
- `watch(radioSettings, save, { deep: true })` 自动持久化
- Audio 元素在 `play()` 时按需创建，切换电台时更新 `src`
- 音量通过 `audio.volume = settings.volume / 100` 映射
- 状态变更时 `emit('radio-state-update', { playing, stationId })`

### 预设电台

```ts
const PRESET_STATIONS: RadioStation[] = [
  {
    id: 'coderadio',
    name: 'Code Radio',
    streamUrl: 'https://coderadio-admin-v2.freecodecamp.org/listen/coderadio/radio.mp3',
    description: 'freeCodeCamp 24h 编程音乐电台',
  },
  // 更多电台由用户后续添加
]
```

### 方法

```ts
function useRadio() {
  return {
    stations,           // 预设电台列表
    currentStation,     // computed - 当前电台对象
    playing,            // ref<boolean>
    volume,             // computed - 音量 0-100
    loading,            // ref<boolean> - 加载中
    error,              // ref<string | null> - 错误信息
    play(),             // 播放当前/上次电台
    pause(),            // 暂停
    toggle(),           // 切换播放/暂停
    switchStation(id),  // 切换电台
    setVolume(v),       // 设置音量 0-100
  }
}
```

## RadioPage.vue 设计

### 布局

```
┌────────────────────────────┐
│  电台标题区                 │
│  ┌──────────────────────┐  │
│  │ 当前电台名 + 描述     │  │
│  │ ▶/⏸  播放控制        │  │
│  │ 🔊━━━━━━━━ 音量滑块  │  │
│  └──────────────────────┘  │
│                            │
│  电台列表                   │
│  ┌─────┐ ┌─────┐ ┌─────┐  │
│  │Code │ │Soma │ │ ... │  │
│  │Radio│ │FM   │ │     │  │
│  └─────┘ └─────┘ └─────┘  │
│                            │
└────────────────────────────┘
```

- 顶部：当前播放的电台信息 + 播放/暂停按钮 + 音量滑块
- 下方：预设电台卡片网格，点击切换
- 播放中的电台卡片有高亮边框

## 灵动岛音符图标

- 在 CapsuleIdle.vue 和 CapsuleFocus.vue 中，当电台播放时在右侧显示小音符 ♪
- 使用 SVG 音符图标，大小跟随 `--island-scale`
- 电台状态通过 island 窗口的 listen 传入，用 ref 存储

### CapsuleIdle 改动

在轮播文字右侧添加音符图标，仅当 `radioPlaying === true` 时显示。

### CapsuleFocus 改动

在倒计时左侧（或右侧）添加音符图标，仅当 `radioPlaying === true` 时显示。

## Panel 导航改动

在 PanelApp.vue 的 `navItems` 中添加 radio 项：
- key: `'radio'`
- label: `'电台'`
- title: `'专注电台'`
- iconPaths: 音符/耳机 SVG path

`currentView` 类型扩展为 `'tasks' | 'settings' | 'completed' | 'memos' | 'stats' | 'radio'`

## 跨窗口通信

Panel 窗口：
```ts
// useRadio.ts 内
watch([playing, currentStationId], () => {
  emit('radio-state-update', { playing: playing.value, stationId: radioSettings.value.currentStationId })
})
```

Island 窗口：
```ts
// Island.vue onMounted
listen('radio-state-update', ({ payload }) => {
  radioPlaying.value = payload.playing
})
```

## 错误处理

- 流加载失败：显示错误提示，设置 `error` ref
- 网络断开：Audio 的 `error` 事件触发，暂停播放并提示
- 无效电台 URL：不预验证，播放时自然失败

## 兼容性

- HTML5 Audio 在 macOS WKWebView 和 Windows WebView2 中均支持 MP3 流播放
- Tauri 无需额外音频插件
- 无 CORS 限制（Tauri WebView 不受浏览器同源策略限制）
