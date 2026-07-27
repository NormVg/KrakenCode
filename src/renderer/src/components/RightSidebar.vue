<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '../stores/projects'
import ChatSessionsPanel from './ChatSessionsPanel.vue'
import FileExplorerPanel from './FileExplorerPanel.vue'

const projectsStore = useProjectsStore()
const { activeView } = storeToRefs(projectsStore)

// Define the shape of a tab
export interface SidebarTab {
  id: string
  label: string
  component: any // Vue component
}


// Contextual tabs based on active view
const contextualTabs = computed<SidebarTab[]>(() => {
  if (activeView.value === 'agent') {
    return [
      { id: 'sessions', label: 'Sessions', component: ChatSessionsPanel }
    ]
  }
  if (activeView.value === 'editor') {
    return [
      { id: 'files', label: 'Files', component: FileExplorerPanel }
    ]
  }
  // Other views might have their own contextual tabs
  return []
})

const activeTab = computed(() => {
  return contextualTabs.value[0]
})
</script>

<template>
  <div class="right-sidebar-container">
    <div class="sidebar-content no-drag">
      <component 
        v-if="activeTab"
        :is="activeTab.component"
      />
    </div>
  </div>
</template>

<style scoped>
.right-sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}
</style>
