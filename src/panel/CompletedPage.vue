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
            <button class="back-btn" @click="emit('back')">← 返回</button>
            <span class="header-title"
                >已完成 ({{ completedTasks.length }})</span
            >
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
                <div class="item-main">
                    <span class="completed-check">✓</span>
                    <span class="completed-title">{{ task.title }}</span>
                    <span
                        class="pomo-count"
                        v-if="task.pomodoroCount > 0"
                        >● {{ task.pomodoroCount }}</span
                    >
                </div>
                <div class="item-meta">
                    <span class="time-label">创建: {{ formatTime(task.createdAt) }}</span>
                    <span class="time-label">完成: {{ formatTime(task.updatedAt) }}</span>
                </div>
                <div class="item-actions">
                    <button
                        class="act-btn"
                        @click="toggleComplete(task.id)"
                        title="恢复"
                    >
                        ↩ 恢复
                    </button>
                    <button
                        class="act-btn delete"
                        @click="deleteTask(task.id)"
                        title="彻底删除"
                    >
                        ✕ 删除
                    </button>
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
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
}

.back-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    cursor: pointer;
    padding: 2px 4px;
    transition: color 0.2s;
}

.back-btn:hover {
    color: #fff;
}

.header-title {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
}

.completed-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
}

.completed-list::-webkit-scrollbar {
    width: 4px;
}
.completed-list::-webkit-scrollbar-track {
    background: transparent;
}
.completed-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 2px;
}

.empty-hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.25);
    padding: 20px 0;
    text-align: center;
}

.completed-item {
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 4px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: background 0.2s;
}

.completed-item:hover {
    background: rgba(255, 255, 255, 0.05);
}

.item-main {
    display: flex;
    align-items: center;
    gap: 8px;
}

.completed-check {
    font-size: 11px;
    color: var(--break-color);
    opacity: 0.6;
    flex-shrink: 0;
}

.completed-title {
    flex: 1;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    text-decoration: line-through;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.pomo-count {
    font-size: 11px;
    color: var(--focus-color);
    opacity: 0.6;
    flex-shrink: 0;
}

.item-meta {
    display: flex;
    gap: 16px;
    margin-top: 4px;
    padding-left: 19px;
}

.time-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.25);
    font-variant-numeric: tabular-nums;
}

.item-actions {
    display: flex;
    gap: 6px;
    margin-top: 6px;
    padding-left: 19px;
    opacity: 0;
    transition: opacity 0.15s;
}

.completed-item:hover .item-actions {
    opacity: 1;
}

.act-btn {
    min-width: 24px;
    height: 24px;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
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

.act-btn.delete:hover {
    color: #f87171;
    border-color: rgba(248, 113, 113, 0.3);
    background: rgba(248, 113, 113, 0.1);
}
</style>
