# 专注电台 - 实现计划

## 实现步骤

- [ ] 1. 创建 `useRadio.ts` composable
  - 定义 RadioStation、RadioSettings 接口
  - 预设电台列表（先占位 Code Radio）
  - HTML5 Audio 元素管理
  - play/pause/toggle/switchStation/setVolume 方法
  - 持久化到 radio.json
  - 广播 radio-state-update 事件

- [ ] 2. 创建 `RadioPage.vue` 面板页面
  - 当前播放区：电台名 + 播放/暂停按钮 + 音量滑块
  - 电台列表：卡片网格布局
  - 播放状态高亮

- [ ] 3. 修改 `PanelApp.vue`
  - currentView 类型添加 'radio'
  - navItems 添加电台导航项（图标 + 标签）
  - 模板中添加 RadioPage 条件渲染

- [ ] 4. 修改 `Island.vue`
  - 添加 radioPlaying ref
  - listen('radio-state-update') 接收电台状态
  - 传递 radioPlaying prop 给 CapsuleIdle 和 CapsuleFocus

- [ ] 5. 修改 `CapsuleIdle.vue`
  - 接收 radioPlaying prop
  - 播放时在轮播文字右侧显示音符图标

- [ ] 6. 修改 `CapsuleFocus.vue`
  - 接收 radioPlaying prop
  - 播放时在倒计时旁显示音符图标

## 验证

```bash
npx vue-tsc --noEmit
cd src-tauri && cargo check
npm run vite:dev  # 手动测试电台播放/暂停/切换/音量/音符图标
```

## Review Gates

- [ ] useRadio.ts 完成 → 验证持久化和跨窗口事件
- [ ] RadioPage.vue 完成 → 验证 UI 交互
- [ ] Island 音符图标完成 → 验证灵动岛播放指示
- [ ] 全量类型检查通过
