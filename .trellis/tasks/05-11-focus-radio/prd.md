# 专注电台

## Goal

为专注岛应用增加专注电台功能，通过 24h 纯音乐背景电台提升专注力和生产力。用户可在专注时段手动播放预设电台，创造沉浸式专注体验。

## Background / Known Context

* 应用采用双窗口架构：main 窗口（灵动岛）+ panel 窗口（专注清单）
* 计时器逻辑运行在 panel 窗口，通过 Tauri 事件广播到 main 窗口
* 已有 composable 模式：模块级单例 ref + watch deep 自动持久化到 $APPData JSON
* 已有 Panel 视图路由模式：PanelApp.vue 通过 currentView ref 切换视图
* Tauri WebView 内可直接使用 HTML5 Audio API 播放 MP3 流
* Code Radio 提供 MP3 流 + 公开 API（曲目信息、专辑封面、SSE 实时推送）

## Requirements

* 支持多个预设电台，每个电台包含名称、流 URL、描述、图标
* 播放/暂停/切换电台控制
* 音量调节
* 电台与计时器独立，用户完全手动控制
* Panel 内新增电台视图页，展示当前电台、曲目信息、播放控制
* 灵动岛在播放状态时显示小音符图标
* 电台设置持久化（上次播放的电台、音量）

## Acceptance Criteria

- [ ] 可播放/暂停电台流
- [ ] 可在预设电台列表中切换
- [ ] 音量可调节（0-100%）
- [ ] Panel 内有电台视图，显示当前电台和播放控制
- [ ] 灵动岛播放时显示音符图标，暂停/停止时隐藏
- [ ] 电台选择和音量设置持久化
- [ ] 类型检查通过 (npx vue-tsc --noEmit)
- [ ] Rust 检查通过 (cd src-tauri && cargo check)

## Out of Scope (explicit)

* 电台与计时器自动联动
* 自定义电台 URL 输入
* YouTube 电台源集成
* 离线音乐/本地文件播放
* 电台收藏/历史记录
* 歌词显示
