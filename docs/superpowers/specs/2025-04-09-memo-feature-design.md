# 备忘录功能设计文档

**日期**: 2025-04-09  
**状态**: 已确认，待实现

---

## 1. 概述

新增备忘录功能，用于记录非任务类的备忘内容。与任务系统的区别：
- 任务：需要完成、有番茄钟计时、可标记完成状态
- 备忘录：纯参考信息，无需完成，随时查看编辑

**布局说明**：采用单栏布局（类似 iOS 备忘录），适配 panel 窗口较窄的特点。

## 2. 用户界面

### 2.1 入口集成

在 `TaskArea.vue` 底部按钮栏新增"备忘录"入口：

```
[今日: X 任务 · Y 分钟]    [📝 备忘录] [✓ 已完成] [⚙ 设置]
```

点击后 `currentView = 'memos'`，进入备忘录页面。

### 2.2 列表页布局（单栏）

```
┌─────────────────────────────────────────────┐
│  📝 备忘录                              [+] │  ← 顶部栏
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  │
│  │ 🔍 搜索（预留）                        │  │  ← 搜索框（V1禁用）
│  └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  分类: [全部 ▼]                    共 12 条 │  ← 分类选择 + 条数
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ ★ 工作任务清单              今天 15:30│  │  ← 置顶备忘
│  │ 完成设计稿、提交代码、 review...      │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 服务器配置信息            昨天 14:20  │  │  ← 普通备忘
│  │ IP: 192.168.1.100 密码: admin...      │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ OSS配置文件             2024-12-10    │  │
│  │ accessKey: AKIAIOSFODNN7EXAMPLE...    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 本周学习计划               星期二     │  │
│  │ 1. 学习 Rust 基础 2. 看完...          │  │
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

**列表项显示内容**：
- **标题**：用户手动输入；未输入时自动提取内容前 10 个字符作为标题
- **时间**：今天显示"今天 HH:mm"，昨天显示"昨天"，本周显示"星期X"，其他显示"MM-DD"
- **内容预览**：前 40 个字符，去除 HTML 标签
- **置顶标识**：置顶项显示 ★ 并有轻微背景高亮

### 2.3 编辑页

```
┌─────────────────────────────────────────────┐
│  ← 返回                     [置顶] [🗑] [✓] │  ← 顶部栏
├─────────────────────────────────────────────┤
│  输入标题...                                 │  ← 标题输入（自动保存）
├─────────────────────────────────────────────┤
│  分类: [工作 ▼]              已保存 今天     │  ← 分类选择 + 保存状态
├─────────────────────────────────────────────┤
│  Aa  B  I  ☑  ─  🖼                          │  ← 工具栏
├─────────────────────────────────────────────┤
│                                             │
│  点击输入内容...                             │  ← 富文本编辑区
│                                             │
│  ☑ 复选框任务                               │
│  ──────────────── 分割线                    │
│  [图片预览]                                  │
│                                             │
└─────────────────────────────────────────────┘
```

**工具栏按钮**：
- `Aa`：文本颜色选择（下拉色板）
- `B`：粗体
- `I`：斜体
- `☑`：插入复选框
- `─`：插入分割线
- `🖼`：插入图片

### 2.4 分类管理弹窗

点击分类下拉旁的"管理"进入：

```
┌─────────────────────────┐
│    分类管理        [×]  │
├─────────────────────────┤
│  📋 全部      （默认）  │
│  💼 工作      [重命名][×]│
│  🏠 个人      [重命名][×]│
│  📚 学习      [重命名][×]│
│                         │
│  [+ 新建分类]           │
└─────────────────────────┘
```

- 默认分类：全部、工作、个人、学习
- "全部"不可删除/重命名
- 删除分类时，该分类下备忘录移至"全部"

## 3. 数据模型

### 3.1 TypeScript 类型

```typescript
// src/composables/useMemos.ts

export interface Memo {
  id: string
  title: string           // 标题，为空时从内容提取
  content: string         // 富文本 HTML
  categoryId: string      // 分类ID，"all"表示全部
  isPinned: boolean       // 是否置顶
  createdAt: number       // 创建时间戳
  updatedAt: number       // 最后更新时间戳
}

export interface MemoCategory {
  id: string
  name: string
  icon: string           // emoji
  isDefault: boolean     // 默认分类不可删除
  order: number          // 排序权重
}
```

### 3.2 默认数据

```typescript
const defaultCategories: MemoCategory[] = [
  { id: 'all', name: '全部', icon: '📋', isDefault: true, order: 0 },
  { id: 'work', name: '工作', icon: '💼', isDefault: true, order: 1 },
  { id: 'personal', name: '个人', icon: '🏠', isDefault: true, order: 2 },
  { id: 'study', name: '学习', icon: '📚', isDefault: true, order: 3 },
]
```

### 3.3 存储路径

- 备忘录：`$APPDATA/pomodoro-island/memos.json`
- 分类：`$APPDATA/pomodoro-island/memo-categories.json`

### 3.4 标题提取规则

当 `title` 为空字符串时，从 `content` 提取：
1. 去除 HTML 标签
2. 去除首尾空白
3. 取前 10 个字符
4. 如果超过 10 字符，追加 "..."

示例：
- 内容："完成设计稿、提交代码、review..." → 标题："完成设计稿、提..."
- 内容："服务器配置" → 标题："服务器配置"

## 4. 功能规格

### 4.1 列表功能

| 功能 | 行为 |
|------|------|
| 分类筛选 | 下拉选择分类，列表上方显示"共 X 条" |
| 排序规则 | 置顶优先 → 更新时间倒序 |
| 新建备忘 | 点击[+]新建空白备忘，进入编辑页 |
| 编辑备忘 | 点击列表项进入编辑页 |
| 删除备忘 | 编辑页点击🗑，确认后删除 |
| 切换置顶 | 编辑页点击[置顶]/[取消置顶] |
| 搜索预留 | 搜索框显示"搜索备忘录"，V1禁用状态 |

### 4.2 富文本功能

使用 `contenteditable` + 自定义工具栏实现：

| 功能 | 实现方式 |
|------|----------|
| 粗体 | `document.execCommand('bold')` |
| 斜体 | `document.execCommand('italic')` |
| 文本颜色 | `document.execCommand('foreColor', false, color)` |
| 复选框 | 插入 `<input type="checkbox">` 自定义样式 |
| 分割线 | 插入 `<hr>` |
| 图片 | Tauri `open` dialog → FileReader 转 base64 → 插入 `<img src="base64...">` |

### 4.3 图片处理

- **存储方式**：base64 直接嵌入 content
- **大小限制**：单张图片 2MB
- **超出提示**：选择图片后检测，超过 2MB 提示"图片过大，请选择小于 2MB 的图片"
- **格式支持**：PNG、JPG、GIF、WebP

## 5. 组件结构

```
src/panel/
├── MemoPage.vue              # 备忘录主页面（列表+编辑页切换）
├── MemoEditor.vue            # 富文本编辑器组件
└── MemoCategoryDialog.vue    # 分类管理弹窗

src/composables/
└── useMemos.ts               # 备忘录状态管理（仿 useTasks.ts）
```

**说明**：采用单栏布局，MemoPage 内部通过状态切换显示列表或编辑页，不需要单独的 MemoList 组件。

## 6. 状态管理

```typescript
// useMemos.ts 导出
const memos = ref<Memo[]>([])
const categories = ref<MemoCategory[]>(defaultCategories)
const currentCategoryId = ref('all')  // 当前筛选的分类

// 计算属性
const filteredMemos = computed(() => {
  // 按 currentCategoryId 过滤（'all' 显示全部）
  // 排序：置顶在前，更新时间倒序
})

const currentCategoryName = computed(() => {
  // 返回当前分类名称
})

const memoCount = computed(() => {
  // 返回当前分类下的备忘录数量
})

const displayTitle = (memo: Memo): string => {
  // 返回标题（空时从内容提取）
}

// 方法
addMemo(categoryId?: string): Memo
updateMemo(id: string, patch: Partial<Memo>)
deleteMemo(id: string)
togglePin(id: string)
addCategory(name: string): MemoCategory
updateCategory(id: string, name: string)
deleteCategory(id: string) // 该分类下备忘移至"全部"
```

## 7. 与现有系统集成

### 7.1 PanelApp.vue

```typescript
// currentView 新增 'memos' 类型
const currentView = ref<'tasks' | 'settings' | 'completed' | 'memos'>('tasks')
```

模板中添加：
```vue
<MemoPage v-else-if="currentView === 'memos'" @back="currentView = 'tasks'" />
```

### 7.2 TaskArea.vue 底部按钮

新增按钮：
```vue
<button class="footer-btn" title="备忘录" @click="emit('memos')">
  📝 备忘录
</button>
```

emit 定义：
```typescript
const emit = defineEmits<{ close: []; settings: []; completed: []; memos: [] }>()
```

## 8. 样式规范

沿用现有设计系统：
- 背景：`rgba(255, 255, 255, 0.035)` 卡片背景
- 边框：`1px solid rgba(255, 255, 255, 0.06)`
- 文字颜色：主文本 `rgba(255,255,255,0.9)`，次要 `rgba(255,255,255,0.6)`，提示 `rgba(255,255,255,0.35)`
- 圆角：卡片 `10px`，按钮 `6px`
- 置顶高亮：边框使用 `var(--focus-color)` 20% 透明度

**列表项样式**：
- 高度：自适应（最小 60px）
- 内边距：`12px 14px`
- 标题：14px，白色，font-weight 500
- 预览：12px，`rgba(255,255,255,0.5)`
- 时间：11px，`rgba(255,255,255,0.35)`，右对齐

## 9. 时间格式化规则

```typescript
function formatMemoTime(timestamp: number): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diff = now.getTime() - timestamp
  
  // 今天
  if (isSameDay(now, date)) {
    return `今天 ${format(date, 'HH:mm')}`
  }
  
  // 昨天
  if (isYesterday(date)) {
    return '昨天'
  }
  
  // 本周（7天内）
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    return weekdays[date.getDay()]
  }
  
  // 其他
  return format(date, 'MM-DD')
}
```

## 10. 实现优先级

1. **P0**: 基础数据模型 + useMemos composable
2. **P0**: 列表页 + 分类筛选 + 条数显示
3. **P0**: 新建/删除 + 标题/纯文本内容编辑
4. **P1**: 富文本工具栏（粗体、斜体、颜色、复选框、分割线）
5. **P1**: 置顶功能
6. **P1**: 分类管理（增删改）
7. **P2**: 图片插入功能（base64，2MB限制）
8. **P2**: 标题自动提取
