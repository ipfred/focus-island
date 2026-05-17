<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount } from "vue";
import { useTasks, type Task } from "../composables/useTasks";
import { useTimerBridge } from "../composables/useTimerBridge";

const emit = defineEmits<{ close: [] }>();

const {
    addTask,
    deleteTask,
    toggleComplete,
    setTaskPriority,
    incrementPomodoro,
    updateTask,
    todayTasks,
} = useTasks();
const {
    start,
    pause,
    resume,
    running,
    activeTaskId,
    displayTime,
    abandon,
    phase,
} = useTimerBridge();

const newTitle = ref("");

type ScrollPhase = "start" | "scroll" | "end";

interface ScrollState {
    taskId: string;
    container: HTMLElement;
    text: HTMLElement;
    frameId: number | null;
    offset: number;
    waitFrames: number;
    phase: ScrollPhase;
}

const SCROLL_SPEED = 0.5;
const START_WAIT_FRAMES = 30;
const END_WAIT_FRAMES = 60;
let activeScroll: ScrollState | null = null;

const activeTasks = computed(() => todayTasks.value);

const top3Tasks = computed(() => {
    return activeTasks.value
        .filter((t) => t.priority > 0)
        .sort((a, b) => a.priority - b.priority);
});

const inboxTasks = computed(() => {
    return activeTasks.value
        .filter((t) => t.priority === 0)
        .sort((a, b) => a.createdAt - b.createdAt);
});

function formatTime(ts: number) {
    const d = new Date(ts);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}月${day}日`;
}

// Input
async function handleInput(event: KeyboardEvent) {
    if (event.key === "Enter") {
        event.preventDefault();
        const t = newTitle.value.trim();
        if (!t) return;

        // Add task (default to today)
        const newTask = addTask(t);
        newTitle.value = "";

        // Shift+Enter to start and close window
        if (event.shiftKey) {
            setTaskPriority(newTask.id, 1);
            start(newTask.id, newTask.title);
            emit("close");
        }
    }
}

// Timer Controls
function handleStartTask(task: Task) {
    if (activeTaskId.value === task.id) {
        if (running.value) pause();
        else resume();
    } else {
        start(task.id, task.title);
    }
}

function handleDoneTask(taskId: string) {
    if (activeTaskId.value === taskId) {
        incrementPomodoro(taskId);
        abandon();
        toggleComplete(taskId);
    } else {
        toggleComplete(taskId);
    }
}

function handleAbandon() {
    abandon();
}

// Drag & Drop
const draggedTaskId = ref<string | null>(null);

function onDragStart(task: Task, event: DragEvent) {
    draggedTaskId.value = task.id;
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
    }
}

function onDrop(targetTask: Task) {
    if (!draggedTaskId.value || draggedTaskId.value === targetTask.id) return;
    setTaskPriority(draggedTaskId.value, targetTask.priority);
    draggedTaskId.value = null;
}

function onDragEnd() {
    draggedTaskId.value = null;
}

// Inline Edit
const editingTaskId = ref<string | null>(null);
const editingTitle = ref("");

function startEdit(task: Task) {
    stopScroll(task.id);
    editingTaskId.value = task.id;
    editingTitle.value = task.title;
    nextTick(() => {
        const input = document.querySelector('.edit-title-input') as HTMLInputElement;
        input?.focus();
        input?.select();
    });
}

function saveEdit() {
    if (!editingTaskId.value) return;
    const trimmed = editingTitle.value.trim();
    if (trimmed && trimmed !== todayTasks.value.find(t => t.id === editingTaskId.value)?.title) {
        updateTask(editingTaskId.value, { title: trimmed });
    }
    editingTaskId.value = null;
}

function cancelEdit() {
    editingTaskId.value = null;
}

// 任务标题滚动效果
function startScroll(taskId: string, eventTarget: EventTarget | null) {
    const containerEl = eventTarget as HTMLElement | null;
    if (!containerEl) return;

    const textEl = containerEl.querySelector(".task-title-text") as HTMLElement | null;
    if (!textEl) return;

    const overflow = textEl.scrollWidth - containerEl.clientWidth;
    if (overflow <= 0) return; // 不需要滚动

    stopScroll();
    textEl.style.transform = "translateX(0)";

    activeScroll = {
        taskId,
        container: containerEl,
        text: textEl,
        frameId: null,
        offset: 0,
        waitFrames: START_WAIT_FRAMES,
        phase: "start",
    };

    scheduleNextScrollFrame();
}

function scheduleNextScrollFrame() {
    if (!activeScroll) return;
    activeScroll.frameId = requestAnimationFrame(runScrollFrame);
}

function runScrollFrame() {
    const state = activeScroll;
    if (!state) return;

    // 节点被替换/卸载时立即停止，避免 RAF 空转
    if (!state.container.isConnected || !state.text.isConnected) {
        stopScroll(state.taskId);
        return;
    }

    const overflow = state.text.scrollWidth - state.container.clientWidth;
    if (overflow <= 0) {
        stopScroll(state.taskId);
        return;
    }

    if (state.phase !== "scroll") {
        state.waitFrames -= 1;
        if (state.waitFrames <= 0) {
            if (state.phase === "end") {
                state.offset = 0;
                state.text.style.transform = "translateX(0)";
            }
            state.phase = "scroll";
        }
        scheduleNextScrollFrame();
        return;
    }

    state.offset += SCROLL_SPEED;
    if (state.offset >= overflow) {
        state.offset = overflow;
        state.text.style.transform = `translateX(-${overflow}px)`;
        state.phase = "end";
        state.waitFrames = END_WAIT_FRAMES;
    } else {
        state.text.style.transform = `translateX(-${state.offset}px)`;
    }

    scheduleNextScrollFrame();
}

function stopScroll(taskId?: string) {
    if (!activeScroll) return;
    if (taskId && activeScroll.taskId !== taskId) return;

    if (activeScroll.frameId !== null) {
        cancelAnimationFrame(activeScroll.frameId);
    }

    activeScroll.text.style.transform = "translateX(0)";
    activeScroll = null;
}

onBeforeUnmount(() => {
    stopScroll();
});
</script>

<template>
    <div class="dashboard">
        <!-- Zone 1: Global Input -->
        <div class="zone-1">
            <input
                class="quick-add-input"
                v-model="newTitle"
                placeholder="接下来专注做什么... (Shift+Enter 闪电开始)"
                @keydown="handleInput"
                autofocus
            />
        </div>

        <!-- Zone 2: Focus Queue (Top 3) -->
        <div class="zone-2">
            <div class="zone-header">核心专注区</div>
            <div v-if="top3Tasks.length === 0" class="empty-hint">
                暂无主打任务，输入后按回车添加
            </div>
            <div
                v-for="(task, index) in top3Tasks"
                :key="task.id"
                class="focus-task-item"
                :class="{ 'is-running': activeTaskId === task.id }"
                :style="activeTaskId === task.id ? { '--active-color': phase === 'break' ? 'var(--break-color)' : 'var(--focus-color)' } : undefined"
                draggable="true"
                @dragstart="onDragStart(task, $event)"
                @dragover.prevent
                @dragenter.prevent
                @drop="onDrop(task)"
                @dragend="onDragEnd"
            >
                <!-- 运行态 -->
                <template v-if="activeTaskId === task.id">
                    <template v-if="running">
                        <div class="running-card">
                            <div class="running-header">
                                <span class="running-dot">●</span>
                                <span 
                                    class="task-title running-title"
                                    @mouseenter="startScroll(task.id, $event.currentTarget)"
                                    @mouseleave="stopScroll(task.id)"
                                >
                                    <span class="task-title-text">{{ task.title }}</span>
                                </span>
                                <span class="task-timer">{{
                                    displayTime
                                }}</span>
                            </div>
                            <div class="running-actions">
                                <button
                                    class="run-btn pause-btn"
                                    @click="pause()"
                                    title="暂停"
                                >
                                    ❚❚ 暂停
                                </button>
                                <button
                                    class="run-btn done-btn"
                                    @click="handleDoneTask(task.id)"
                                    title="完成"
                                >
                                    ✓ 完成
                                </button>
                                <button
                                    class="run-btn abandon-btn"
                                    @click="handleAbandon()"
                                    title="停止"
                                >
                                    ■ 停止
                                </button>
                            </div>
                        </div>
                    </template>

                    <!-- 暂停态 -->
                    <template v-else>
                        <div class="running-card paused">
                            <div class="running-header">
                                <span class="running-dot paused-dot">●</span>
                                <span 
                                    class="task-title running-title"
                                    @mouseenter="startScroll(task.id, $event.currentTarget)"
                                    @mouseleave="stopScroll(task.id)"
                                >
                                    <span class="task-title-text">{{ task.title }}</span>
                                </span>
                                <span class="task-timer">{{
                                    displayTime
                                }}</span>
                            </div>
                            <div class="running-actions">
                                <button
                                    class="run-btn pause-btn"
                                    @click="resume()"
                                    title="继续"
                                >
                                    ▶ 继续
                                </button>
                                <button
                                    class="run-btn done-btn"
                                    @click="handleDoneTask(task.id)"
                                    title="完成"
                                >
                                    ✓ 完成
                                </button>
                                <button
                                    class="run-btn abandon-btn"
                                    @click="handleAbandon()"
                                    title="停止"
                                >
                                    ■ 停止
                                </button>
                            </div>
                        </div>
                    </template>
                </template>

                <!-- 正常态（非活跃任务） -->
                <template v-else>
                    <div class="task-row">
                        <span class="rank-badge">{{
                            index === 0
                                ? "\u2460"
                                : index === 1
                                  ? "\u2461"
                                  : "\u2462"
                        }}</span>
                        <button
                            class="check-circle"
                            @click="handleDoneTask(task.id)"
                            title="完成"
                        ></button>
                        <input
                            v-if="editingTaskId === task.id"
                            class="edit-title-input task-title"
                            v-model="editingTitle"
                            @keydown.enter="saveEdit"
                            @keydown.esc="cancelEdit"
                            @blur="saveEdit"
                        />
                        <span v-else 
                            class="task-title" 
                            @dblclick="startEdit(task)"
                            @mouseenter="startScroll(task.id, $event.currentTarget)"
                            @mouseleave="stopScroll(task.id)"
                        >
                            <span class="task-title-text">{{ task.title }}</span>
                        </span>
                        <span class="pomo-count" v-if="task.pomodoroCount > 0"
                            >● {{ task.pomodoroCount }}</span
                        >
                        <span class="task-time">{{
                            formatTime(task.createdAt)
                        }}</span>
                        <div class="task-actions">
                            <button
                                class="act-btn delete"
                                @click="deleteTask(task.id)"
                                title="删除"
                            >
                                ✕
                            </button>
                        </div>
                        <button
                            class="start-btn"
                            @click="handleStartTask(task)"
                            title="开始"
                        >
                            ▶
                        </button>
                    </div>
                </template>
            </div>
        </div>

        <!-- Zone 3: Inbox -->
        <div class="zone-3">
            <div class="zone-header">稍后处理 ({{ inboxTasks.length }})</div>
            <div class="inbox-list">
                <div v-if="inboxTasks.length === 0" class="empty-hint">
                    收件箱为空
                </div>
                <div
                    v-for="task in inboxTasks"
                    :key="task.id"
                    class="inbox-item"
                >
                    <span class="inbox-dot">·</span>
                    <input
                        v-if="editingTaskId === task.id"
                        class="edit-title-input inbox-title"
                        v-model="editingTitle"
                        @keydown.enter="saveEdit"
                        @keydown.esc="cancelEdit"
                        @blur="saveEdit"
                    />
                    <span v-else 
                        class="inbox-title" 
                        @dblclick="startEdit(task)"
                        @mouseenter="startScroll(task.id, $event.currentTarget)"
                        @mouseleave="stopScroll(task.id)"
                    >
                        <span class="task-title-text">{{ task.title }}</span>
                    </span>
                    <span class="task-time">{{
                        formatTime(task.createdAt)
                    }}</span>
                    <div class="inbox-actions">
                        <button
                            class="act-btn"
                            @click="toggleComplete(task.id)"
                            title="完成"
                        >
                            ✓
                        </button>
                        <button
                            class="act-btn delete"
                            @click="deleteTask(task.id)"
                            title="删除"
                        >
                            ✕
                        </button>
                    </div>
                    <button
                        class="promote-btn"
                        @click="setTaskPriority(task.id, 1)"
                        title="移至专注区"
                    >
                        ↑
                    </button>
                </div>
            </div>
        </div>

    </div>
</template>

<style scoped>
/* Base Panel UI */
.dashboard {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    overflow: hidden;
    background: transparent;
    color: #e8e8ea;
}

/* Zone 1: Input */
.zone-1 {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
}

.quick-add-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px 14px;
    color: #fff;
    font-size: 13px;
    outline: none;
    transition: all 0.2s;
    box-sizing: border-box;
}

.quick-add-input:focus {
    border-color: color-mix(in srgb, var(--focus-color) 60%, transparent);
    box-shadow: 0 0 0 2px
        color-mix(in srgb, var(--focus-color) 20%, transparent);
}

.quick-add-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
}

/* Zone headers & hints */
.zone-header {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    margin-bottom: 6px;
    font-weight: 500;
    letter-spacing: 0.5px;
}

.empty-hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.25);
    padding: 6px 0;
}

/* Zone 2: Focus Queue */
.zone-2 {
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
}

.focus-task-item {
    background: rgba(255, 255, 255, 0.035);
    border-radius: 10px;
    margin-bottom: 4px;
    padding: 5px 10px;
    transition: all 0.2s;
    border: 1px solid rgba(255, 255, 255, 0.06);
    cursor: grab;
}

.focus-task-item:active {
    cursor: grabbing;
}

.focus-task-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
}

/* Running task card */
.focus-task-item.is-running {
    background: color-mix(in srgb, var(--active-color) 10%, transparent);
    border-color: color-mix(in srgb, var(--active-color) 30%, transparent);
    border-left: 3px solid var(--active-color);
    padding: 8px 10px;
    cursor: default;
}

.running-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.running-header {
    display: flex;
    align-items: center;
    gap: 8px;
}

.running-dot {
    color: var(--active-color);
    font-size: 10px;
    flex-shrink: 0;
}

.paused-dot {
    animation: blink 1.2s ease-in-out infinite;
}

@keyframes blink {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.3;
    }
}

.running-title {
    color: #fff !important;
    font-weight: 600 !important;
}

.running-actions {
    display: flex;
    gap: 6px;
}

.run-btn {
    height: 28px;
    padding: 0 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s;
}

.pause-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
}

.pause-btn:hover {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
}

.done-btn {
    background: color-mix(in srgb, var(--break-color) 20%, transparent);
    color: var(--break-color);
    border-color: color-mix(in srgb, var(--break-color) 30%, transparent);
}

.done-btn:hover {
    background: color-mix(in srgb, var(--break-color) 35%, transparent);
}

.abandon-btn {
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    border-color: rgba(255, 255, 255, 0.08);
}

.abandon-btn:hover {
    color: #f87171;
    border-color: rgba(248, 113, 113, 0.3);
    background: rgba(248, 113, 113, 0.1);
}

.progress-bar {
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    width: 100%;
    border-radius: 2px;
    background: var(--active-color);
    transform-origin: left;
}

.paused-fill {
    animation: progress-blink 1.5s ease-in-out infinite;
}

@keyframes progress-blink {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.3;
    }
}

/* Normal task row */
.task-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
}

.rank-badge {
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    line-height: 1;
    flex-shrink: 0;
    color: var(--focus-color);
    background: color-mix(in srgb, var(--focus-color) 15%, transparent);
    border-radius: 50%;
}

.check-circle {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    border: 2px solid rgba(255, 255, 255, 0.28);
    background: transparent;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition:
        border-color 0.2s,
        background 0.2s;
}

.check-circle:hover {
    border-color: var(--break-color);
    background: color-mix(in srgb, var(--break-color) 20%, transparent);
}

.task-title {
    flex: 1;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    position: relative;
    min-width: 0;
    cursor: default;
}

.task-title-text {
    display: inline-block;
    will-change: transform;
}

.running-title {
    color: #fff !important;
    font-weight: 600 !important;
}

.running-title .task-title-text {
    color: #fff !important;
    font-weight: 600 !important;
}

.edit-title-input {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid color-mix(in srgb, var(--focus-color) 50%, transparent);
    border-radius: 4px;
    padding: 2px 6px;
    outline: none;
    box-sizing: border-box;
    min-width: 0;
}

.pomo-count {
    font-size: 11px;
    color: var(--focus-color);
    opacity: 0.7;
}

.task-timer {
    font-size: 13px;
    font-weight: 700;
    color: var(--active-color);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
}

.task-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
}

.focus-task-item:hover .task-actions {
    opacity: 1;
}

/* Unified action button */
.act-btn {
    min-width: 20px;
    height: 20px;
    padding: 1px 4px;
    border-radius: 5px;
    font-size: 10px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    text-align: center;
    transition:
        background 0.2s,
        color 0.2s,
        border-color 0.2s;
}

.act-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
}

.start-btn {
    min-width: 20px;
    height: 20px;
    padding: 1px 4px;
    border-radius: 5px;
    font-size: 10px;
    font-weight: 600;
    background: color-mix(in srgb, var(--focus-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--focus-color) 30%, transparent);
    color: var(--focus-color);
    cursor: pointer;
    text-align: center;
    flex-shrink: 0;
    transition:
        background 0.2s,
        color 0.2s,
        border-color 0.2s;
}

.start-btn:hover {
    background: color-mix(in srgb, var(--focus-color) 25%, transparent);
    border-color: color-mix(in srgb, var(--focus-color) 50%, transparent);
}

.act-btn.delete {
    color: rgba(255, 255, 255, 0.5);
}

.act-btn.delete:hover {
    color: #f87171;
    border-color: rgba(248, 113, 113, 0.3);
    background: rgba(248, 113, 113, 0.1);
}

/* Zone 3: Inbox */
.zone-3 {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
}

.zone-3::-webkit-scrollbar {
    width: 4px;
}
.zone-3::-webkit-scrollbar-track {
    background: transparent;
}
.zone-3::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 2px;
}

.inbox-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.inbox-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 6px;
    transition: background 0.2s;
    cursor: default;
}

.inbox-item:hover {
    background: rgba(255, 255, 255, 0.04);
}

.promote-btn {
    min-width: 20px;
    height: 20px;
    padding: 1px 4px;
    border-radius: 5px;
    font-size: 10px;
    font-weight: 600;
    background: color-mix(in srgb, var(--focus-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--focus-color) 30%, transparent);
    color: var(--focus-color);
    cursor: pointer;
    text-align: center;
    flex-shrink: 0;
    transition:
        background 0.2s,
        color 0.2s,
        border-color 0.2s;
}

.promote-btn:hover {
    background: color-mix(in srgb, var(--focus-color) 25%, transparent);
    border-color: color-mix(in srgb, var(--focus-color) 50%, transparent);
}

.inbox-dot {
    color: var(--focus-color);
}

.inbox-title {
    flex: 1;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    position: relative;
    min-width: 0;
    cursor: default;
}

.inbox-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
}

.inbox-item:hover .inbox-actions {
    opacity: 1;
}

.task-time {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.25);
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    /*width: 46px;
    text-align: right;*/
}

</style>
