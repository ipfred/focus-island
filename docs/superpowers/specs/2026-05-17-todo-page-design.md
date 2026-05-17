# TODO Page Feature - Phase 1 Design Spec

## Overview

Replace the "完成" (Completed) navigation tab with a TODO page featuring custom groups, due dates, subtasks, and a task detail view. Also restructure the data model to support these features.

## Phase 1 Scope

- Data model refactor (Task → groupId + dueDate, Subtask nested array)
- Group management system (with colors, referencing memo color system)
- TODO page UI (main list with tabs, quick-add, task cards)
- Task detail page (inline panel view switch)
- Navigation update (replace "完成" tab with TODO tab, ✓ icon)

Phase 2 (future): Home page redesign, island subtask timer display.

---

## Data Model Changes

### Task model refactor

**Before:**
```ts
interface Task {
  id: string; title: string; note: string;
  category: 'today' | 'tomorrow' | 'week';  // REMOVED
  completed: boolean; pomodoroCount: number;
  priority: 0 | 1 | 2 | 3;
  createdAt: number; updatedAt: number;
}
```

**After:**
```ts
interface Task {
  id: string
  title: string
  note: string
  groupId: string | null        // null = no group, grouped by dueDate
  dueDate: string | null        // ISO date string 'YYYY-MM-DD', null = no due date
  completed: boolean
  pomodoroCount: number
  priority: 0 | 1 | 2 | 3     // 0=inbox, 1-3=focus ranking within group/date
  subtasks: Subtask[]
  createdAt: number
  updatedAt: number
}
```

### Subtask model (nested in Task)

```ts
interface Subtask {
  id: string
  title: string
  completed: boolean
  pomodoroCount: number
}
```

### TaskGroup model (separate persistence)

```ts
interface TaskGroup {
  id: string
  name: string
  color: string     // color ID from CATEGORY_COLOR_MAP (yellow, green, blue, etc.)
  order: number
  isDefault: boolean // built-in groups cannot be deleted
}
```

Default groups: none. User creates their own. Time-based views (今天/明天/最近一周) are virtual, not stored groups.

### Computed category derivation

The old `category` field is replaced by runtime computation:

```ts
function getTaskTimeCategory(task: Task): 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'nodate' {
  if (!task.dueDate) return 'nodate'
  const today = startOfDay(new Date())
  const due = startOfDay(parseISO(task.dueDate))
  const diffDays = differenceInCalendarDays(due, today)
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays <= 6) return 'week'
  return 'later'
}
```

### Data migration

When loading existing `tasks.json`:
- Tasks with old `category` get `dueDate` calculated: today/tomorrow/+2days
- `category` field is dropped
- `subtasks` defaults to `[]`
- `groupId` defaults to `null`

---

## Group Management

### Persistence

- Stored in `$APPDATA/focus-island/task-groups.json`
- Uses same color palette as memo categories (`CATEGORY_COLOR_MAP` from `useMemos.ts`)
- Group CRUD operations in `useTaskGroups.ts` composable

### Default groups

None — users start with only time-based virtual groups (今天/明天/最近一周).

### Group settings dialog

Accessed from the "清单分类设置按钮" (gear icon) in the TODO page header.

- List existing groups with name + color dot
- Add new group: name input + color picker
- Delete group: confirmation, tasks in deleted group get `groupId = null`
- Reorder groups via drag (future enhancement, not in v1)

---

## TODO Page UI

### Navigation change

Replace the "完成" nav item:

```ts
{
  key: 'todo',
  label: 'TODO',
  title: 'TODO',
  iconPaths: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M9 12l2 2 4-4'],  // circle with checkmark
}
```

### Page layout (top to bottom)

```
┌─────────────────────────────────┐
│ [← Back]  TODO                  │  ← Title bar
├─────────────────────────────────┤
│ [Group ▼] [____input____] [📅] │  ← Quick add row
├─────────────────────────────────┤
│ 今天 | 明天 | 一周 | [group▼] [⚙]│  ← Tab bar
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ ○ Task name     🍅3  📅5/18 │ │  ← Task card
│ │   └ ○ Subtask 1      [▶]   │ │     with subtasks
│ │   └ ○ Subtask 2      [▶]   │ │     and pomodoro button
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ ○ Another task   🍅1  📅5/19│ │
│ └─────────────────────────────┘ │
│ ...                             │
├─────────────────────────────────┤
│ 已完成 (3) ▼                    │  ← Collapsible completed section
│ └ ○ Done task            🍅2   │
└─────────────────────────────────┘
```

### Quick-add row

- **Left**: Group dropdown (shows groups + "无分组" option). Defaults to current tab group.
- **Center**: Text input for task title. Enter to create.
- **Right**: Date picker button. Defaults to today. Clicking opens a mini calendar popover.
- If due date < today → show date in red/orange as overdue indicator.
- If no group selected and due date is set → task appears in the matching time tab.

### Tab bar

- Fixed tabs: 今天, 明天, 最近一周, 已完成
- Custom groups appear as additional tabs after the time tabs
- If too many groups → overflow dropdown on the right
- Gear icon (⚙) on far right → opens group settings dialog

### Task card

Each task card shows:
- **Left**: Completion checkbox (circle ○ → filled ✓)
- **Center**: Task title (click to enter detail view), overdue dates in accent color
- **Below title**: Subtask list (one level only, each with own checkbox)
- **Right**: 
  - Pomodoro count badge (🍅 icon + number)
  - Due date badge (📅 formatted date)
  - Play button (▶) to start pomodoro timer on that task
- Overdue tasks have a left border accent in `--focus-color`
- Right-click context menu: 设置到期日(今日/明日), 删除

### Completed section

- Collapsible at bottom
- Shows completed tasks for current tab/filter
- "清理3天前" and "全部删除" actions in header

---

## Task Detail Page

Accessed by clicking a task card title. Replaces TODO list view within the panel (uses `currentView` pattern with back button).

### Layout

```
┌─────────────────────────────────┐
│ [← Back]  任务详情              │
├─────────────────────────────────┤
│ ○ Task Title               🍅3  │  ← Editable title
│                                 │
│ 到期日       2026-05-20 📅     │  ← Date picker
│ 分组          工作项目 ▼        │  ← Group dropdown
│                                 │
│ 备注                           │
│ ┌─────────────────────────────┐│
│ │ Free text note area         ││  ← Editable textarea
│ └─────────────────────────────┘│
│                                 │
│ 子任务                    [+添加]│
│ └ ○ Subtask 1      🍅1  [▶]  │
│ └ ● Subtask 2      🍅0  [▶]  │
│                                 │
│         [删除任务]              │
└─────────────────────────────────┘
```

### Features

- Edit task title inline
- Change due date via date picker
- Change group via dropdown
- Edit notes in textarea
- Add/complete/delete subtasks
- Start pomodoro on subtasks (plays on island)
- Delete task with confirmation

---

## Composable Changes

### `useTasks.ts` — full refactor

- Remove `TaskCategory`, add `dueDate`, `groupId`, `subtasks`
- Add `Subtask` interface
- Computed views: `overdueTasks`, `todayTasks`, `tomorrowTasks`, `weekTasks`, `groupTasks(groupId)`
- CRUD: `addTask`, `updateTask`, `deleteTask`, `toggleComplete`
- Subtask CRUD: `addSubtask`, `toggleSubtask`, `deleteSubtask`
- Migration logic on load for old data format
- `startPomodoroOnSubtask(taskId, subtaskId)` — sets `activeTaskId` + `activeSubtaskId`

### New: `useTaskGroups.ts`

- CRUD for `TaskGroup`: `addGroup`, `deleteGroup`, `renameGroup`, `reorderGroup`
- Persisted to `focus-island/task-groups.json`
- Default: empty array (no default groups)

### `useTimer.ts` changes

- Add `activeSubtaskId: ref<string | null>` and `activeSubtaskTitle: ref<string | null>`
- When `activeSubtaskId` is set, island displays subtask title + parent task title

### `useTimerBridge.ts` changes

- Broadcast `activeSubtaskId`, `activeSubtaskTitle` in `TimerStatePayload`
- When subtask timer running, panel updates title accordingly

### Island display

Phase 1: `CapsuleFocus` shows subtask title when active (falls back to task title).
The `pendingNotification` and `confirmNotification` flow from the recently merged notification feature will show subtask name when completing a subtask's pomodoro.

---

## File Structure

New/modified files:

```
src/composables/
  useTasks.ts          — refactor: new model, migration, subtask CRUD
  useTaskGroups.ts     — new: group management
  useTimer.ts          — add activeSubtaskId/activeSubtaskTitle
  useTimerBridge.ts    — broadcast subtask info

src/panel/
  TodoPage.vue         — new: main TODO list page
  TaskDetailPage.vue   — new: task detail view
  TaskGroupDialog.vue  — new: group settings dialog (reference MemoCategoryDialog)
  CompletedPage.vue    — modified → removed from nav, kept as import for now
  PanelApp.vue         — modify: replace 'completed' nav with 'todo', add views

src/components/
  (no changes in Phase 1; CapsuleFocus subtask display is Phase 2)
```

---

## Implementation Order

1. **Data model**: Refactor `useTasks.ts` + create `useTaskGroups.ts`
2. **Group dialog**: `TaskGroupDialog.vue` (reference MemoCategoryDialog pattern)
3. **TODO page**: `TodoPage.vue` with tabs, quick-add, task cards, subtasks
4. **Task detail**: `TaskDetailPage.vue` 
5. **Navigation**: Update `PanelApp.vue` — replace "完成" with "TODO" tab
6. **Timer subtask support**: Update `useTimer.ts` + `useTimerBridge.ts` for subtask tracking
7. **Migration**: Ensure existing tasks.json data migrates cleanly
