<script setup lang="ts">
defineEmits<{ back: [] }>()
</script>

<template>
    <div class="stats-page">
        <div class="placeholder">
            <div class="icon">📊</div>
            <div class="title">统计功能开发中</div>
            <div class="subtitle">敬请期待，这里将展示你的专注数据</div>
        </div>
    </div>
</template>

<style scoped>
.stats-page {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #e8e8ea;
    padding: 24px;
}

.placeholder {
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
}

.icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.6;
}

.title {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 6px;
}

.subtitle {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.35);
}
</style>
