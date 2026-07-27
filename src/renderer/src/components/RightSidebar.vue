<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '../stores/projects'
import ToolsPanel from './ToolsPanel.vue'
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

// Global tools that are always available
const toolsTab: SidebarTab = {
  id: 'tools',
  label: 'Tools',
  component: ToolsPanel
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

const tabs = computed<SidebarTab[]>(() => {
  return [...contextualTabs.value, toolsTab]
})

const activeTabId = ref(tabs.value[0]?.id || 'tools')

// Update active tab when tabs change (e.g. view switch)
watch(tabs, (newTabs) => {
  if (!newTabs.find(t => t.id === activeTabId.value)) {
    activeTabId.value = newTabs[0]?.id || 'tools'
  }
}, { immediate: true })

const activeTab = computed(() => {
  return tabs.value.find(t => t.id === activeTabId.value)
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
    
    <div class="sidebar-tabs no-drag">
      <div 
        v-for="tab in tabs" 
        :key="tab.id"
        :class="['sidebar-tab', { active: activeTabId === tab.id }]"
        @click="activeTabId = tab.id"
      >
        {{ tab.label }}
      </div>
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
  padding: 24px 0;
  overflow-y: auto;
}

.sidebar-tabs {
  display: flex;
  padding: 12px 0 24px 0;
  gap: 16px;
  justify-content: center;
}

.sidebar-tab {
  font-size: 0.85em;
  color: var(--text-muted);
  cursor: pointer;
  padding-bottom: 4px;
  position: relative;
  /* Maya-design */
  transition: color 0.3s ease;
}

.sidebar-tab::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  width: 0%;
  height: 2px;
  background-color: var(--text-main);
  transition: width 0.4s cubic-bezier(0.25, 1, 0.5, 1), left 0.4s cubic-bezier(0.25, 1, 0.5, 1);
  border-radius: 2px;
}

.sidebar-tab:hover {
  color: var(--text-main);
}

.sidebar-tab:hover::after {
  width: 40%;
  left: 30%;
}

.sidebar-tab.active {
  color: var(--text-main);
  font-weight: 500;
}

.sidebar-tab.active::after {
  width: 100%;
  left: 0;
}
</style>
