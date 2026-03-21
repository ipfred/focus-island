<script setup lang="ts">
import { computed } from "vue";
import { useTasks } from "../composables/useTasks";

const emit = defineEmits<{ back: [] }>();

const { tasks, deleteTask, toggleComplete } = useTasks();

const completedTasks = computed(() =>
    [...tasks.value.filter((t) => t.completed)].sort(
        (a, b) => b.updatedAt - a.updatedAt,
    ),
);

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

function deleteOlderThan3Days() {
    const cutoff = Date.now() - THREE_DAYS;
    const toDelete = completedTasks.value.filter((t) => t.updatedAt < cutoff);
    toDelete.forEach((t) => deleteTask(t.id));
}

function deleteAll() {
    const ids = completedTasks.value.map((t) => t.id);
    ids.forEach((id) => deleteTask(id));
}

function formatTime(ts: number) {
    const d = new Date(ts);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${month}/${day} ${h}:${m}`;
}
</script>

<template>
    <div class="completed-page">
        <div class="page-header">
            <button class="back-btn" @click="emit('back')">←</button>
            <span class="header-title">已完成 ({{ completedTasks.length }})</span>
            <div class="header-spacer"></div>
            <button
                v-if="completedTasks.length > 0"
                class="header-act"
                @click="deleteOlderThan3Days"
            >
                清理3天前
            </button>
            <button
                v-if="completedTasks.length > 0"
                class="header-act danger"
                @click="deleteAll"
            >
                全部删除
            </button>
        </div>

        <div class="completed-list">
            <div v-if="completedTasks.length === 0" class="empty-hint">
                暂无已完成的任务
            </div>
            <div
                v-for="task in completedTasks"
                :key="task.id"
                class="completed-item"
            >
                <span class="completed-check">✓</span>
                <div class="item-body">
                    <span class="completed-title">{{ task.title }}</span>
                    <span class="item-meta">
                        {{ formatTime(task.createdAt) }} → {{ formatTime(task.updatedAt) }}
                        <span v-if="task.pomodoroCount > 0" class="pomo-count">● {{ task.pomodoroCount }}</span>
                    </span>
                </div>
                <div class="item-actions">
                    <button class="act-btn" @click="toggleComplete(task.id)" title="恢复">↩</button>
                    <button class="act-btn delete" @click="deleteTask(task.id)" title="删除">✕</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.completed-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: #e8e8ea;
}

.page-header {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.back-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    cursor: pointer;
    padding: 0 4px;
    transition: color 0.2s;
}

.back-btn:hover {
    color: #fff;
}

.header-title {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
}

.header-spacer {
    flex: 1;
}

.header-act {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 5px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
    cursor: pointer;
    padding: 3px 8px;
    transition: all 0.2s;
}

.header-act:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
}

.header-act.danger:hover {
    color: #f87171;
    border-color: rgba(248, 113, 113, 0.3);
    background: rgba(248, 113, 113, 0.1);
}

.completed-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px 12px;
}

.completed-list::-webkit-scrollbar { width: 4px; }
.completed-list::-webkit-scrollbar-track { background: transparent; }
.completed-list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 2px; }

.empty-hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.25);
    padding: 20px 0;
    text-align: center;
}

.completed-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    margin-bottom: 2px;
    transition: background 0.2s;
}

.completed-item:hover {
    background: rgba(255, 255, 255, 0.04);
}

.completed-check {
    font-size: 10px;
    color: var(--break-color);
    opacity: 0.5;
    flex-shrink: 0;
}

.item-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.completed-title {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.45);
    text-decoration: line-through;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.item-meta {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.2);
    font-variant-numeric: tabular-nums;
}

.pomo-count {
    color: var(--focus-color);
    opacity: 0.5;
    margin-left: 6px;
}

.item-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;
}

.completed-item:hover .item-actions {
    opacity: 1;
}

.act-btn {
    min-width: 22px;
    height: 22px;
    padding: 2px 6px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.2s;
}

.act-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
}

.act-btn.delete:hover {
    color: #f87171;
    border-color: rgba(248, 113, 113, 0.3);
    background: rgba(248, 113, 113, 0.1);
}
</style>
