<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useTimerBridge } from '../composables/useTimerBridge'
import SideNav from './SideNav.vue'
import TaskArea from './TaskArea.vue'
import TaskDetail from './TaskDetail.vue'
import PanelTitleBar from './PanelTitleBar.vue'
import type { Task, TaskCategory } from '../composables/useTasks'

const { startBridge } = useTimerBridge()

const selectedCategory = ref<TaskCategory>('today')
const selectedTask = ref<Task | null>(null)

onMounted(() => {
  startBridge()
})

function onTaskSelect(task: Task) {
  selectedTask.value = selectedTask.value?.id === task.id ? null : task
}

function closeDetail() {
  selectedTask.value = null
}

async function closeWindow() {
  await invoke('hide_panel')
}
</script>

<template>
  <div class="panel-root">
    <PanelTitleBar @close="closeWindow" />
    <div class="panel-body">
      <SideNav :selected="selectedCategory" @select="selectedCategory = $event" />
      <TaskArea
        :category="selectedCategory"
        :selected-task-id="selectedTask?.id ?? null"
        @task-select="onTaskSelect"
      />
      <Transition name="slide-right">
        <TaskDetail
          v-if="selectedTask"
          :task="selectedTask"
          @close="closeDetail"
        />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.panel-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: rgba(18, 18, 22, 0.96);
  backdrop-filter: blur(24px);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.08);
  overflow: hidden;
  color: #e8e8ea;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.panel-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.22s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>
