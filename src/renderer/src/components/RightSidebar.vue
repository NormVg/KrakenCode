<script setup lang="ts">
import { ref, shallowRef, computed } from 'vue'
import ToolsPanel from './ToolsPanel.vue'

// Define the shape of a tab
export interface SidebarTab {
  id: string
  label: string
  component: any // Vue component
}

// In a real application, this could be moved to a Pinia store 
// so that different plugins or systems can register their own tabs dynamically.
const tabs = shallowRef<SidebarTab[]>([
  {
    id: 'tools',
    label: 'Tools',
    component: ToolsPanel
  }
])

const activeTabId = ref('tools')

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
