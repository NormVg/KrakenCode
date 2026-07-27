<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from './stores/config'
import { useProjectsStore } from './stores/projects'
import SettingsModal from './components/SettingsModal.vue'
import ProjectsSidebar from './components/ProjectsSidebar.vue'
import RightSidebar from './components/RightSidebar.vue'
import { PanelLeft, PanelRight, CircleDotDashed, Code, Globe, SplitSquareHorizontal, Network, Terminal } from 'lucide-vue-next'
import './assets/main.css'

import AgentView from './components/views/AgentView.vue'
import EditorView from './components/views/EditorView.vue'
import WebViewView from './components/views/WebViewView.vue'
import DiffView from './components/views/DiffView.vue'
import ArchGraphView from './components/views/ArchGraphView.vue'
import TerminalView from './components/views/TerminalView.vue'

const views = {
  agent: { component: AgentView, icon: CircleDotDashed, label: 'Agent' },
  editor: { component: EditorView, icon: Code, label: 'Editor' },
  web: { component: WebViewView, icon: Globe, label: 'Web' },
  diff: { component: DiffView, icon: SplitSquareHorizontal, label: 'Diff' },
  graph: { component: ArchGraphView, icon: Network, label: 'Graph' },
  terminal: { component: TerminalView, icon: Terminal, label: 'Terminal' }
}

// Configuration State via Pinia
const configStore = useConfigStore()
const { isSetup } = storeToRefs(configStore)
const isSettingsOpen = ref(false)
const isRightSidebarOpen = ref(true)
const isLeftSidebarOpen = ref(true)

// Sidebar Resizing
const rightSidebarWidth = ref(300)
const isResizingRight = ref(false)

const startResizeRight = (_e: MouseEvent) => {
  isResizingRight.value = true
  document.addEventListener('mousemove', handleResizeRight)
  document.addEventListener('mouseup', stopResizeRight)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const handleResizeRight = (e: MouseEvent) => {
  if (!isResizingRight.value) return
  const newWidth = document.body.clientWidth - e.clientX - 8 // 8px for layout gap/padding
  if (newWidth > 200 && newWidth < 450) {
    rightSidebarWidth.value = newWidth
  }
}

const stopResizeRight = () => {
  isResizingRight.value = false
  document.removeEventListener('mousemove', handleResizeRight)
  document.removeEventListener('mouseup', stopResizeRight)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// Ensure Settings opens if we somehow lose setup state
watch(isSetup, (newVal) => {
  if (!newVal) isSettingsOpen.value = true
})

// Chat state moved to AgentView.vue

// Projects State
const projectsStore = useProjectsStore()

// Auto-initialize if possible
onMounted(async () => {
  await projectsStore.loadData()
  if (!isSetup.value) {
    try {
      const success = await configStore.initializeAgent()
      if (!success) {
        isSettingsOpen.value = true
      }
    } catch (e) {
      console.error("Auto-init failed", e)
      isSettingsOpen.value = true
    }
  }
})

</script>

<template>
  <div class="layout-container" :class="{ 'left-sidebar-closed': !isLeftSidebarOpen }">
    <!-- Dedicated top drag region -->
    <div class="titlebar-drag-region"></div>
    <div class="layout">

      <!-- Left Sidebar (Projects) -->
      <Transition name="sidebar-left">
        <aside v-if="isLeftSidebarOpen" class="left-sidebar no-drag">
          <ProjectsSidebar @open-settings="isSettingsOpen = true" />
        </aside>
      </Transition>

      <!-- Main Content (Island) -->
      <main class="main-content no-drag">

      <!-- Settings Modal via component -->
      <SettingsModal
        v-if="isSettingsOpen"
        @close="isSettingsOpen = false"
      />



      <!-- Dynamic View Component -->
      <div class="view-container">
        <component 
          v-for="(view, key) in views"
          :key="key"
          :is="view.component"
          class="app-view"
          :class="{ 'app-view-hidden': projectsStore.activeView !== key }"
        />
      </div>

      <!-- Global Bottom Bar -->
      <div class="global-bottom-bar composer-width no-drag">
        <div class="header-left-group">
          <button class="icon-btn" @click="isLeftSidebarOpen = !isLeftSidebarOpen" title="Toggle Sidebar">
            <PanelLeft :size="16" />
          </button>
          <div class="chat-breadcrumbs">
            <span class="muted">{{ projectsStore.activeProject?.name || 'No Project' }}</span>
            <span class="divider">/</span>
            <span>{{ views[projectsStore.activeView].label }}</span>
          </div>
        </div>

        <!-- View Toggles & Right Sidebar (Right Aligned) -->
        <div class="header-right-group">
          <div class="bottom-view-toggles">
            <button
              v-for="(view, key) in views"
              :key="key"
              class="bottom-tab-btn"
              :class="{ active: projectsStore.activeView === key }"
              @click="projectsStore.activeView = key"
              :title="view.label"
            >
              <component :is="view.icon" :size="16" />
            </button>
          </div>

          <div class="divider-vertical"></div>

          <button class="icon-btn" @click="isRightSidebarOpen = !isRightSidebarOpen" title="Toggle Tools">
            <PanelRight :size="16" />
          </button>
        </div>
      </div>
    </main>

    <!-- Right Sidebar -->
    <Transition name="slide-right">
      <aside class="right-sidebar" v-if="isRightSidebarOpen" :style="{ width: `${rightSidebarWidth}px` }">
        <div class="resizer" :class="{ active: isResizingRight }" @mousedown="startResizeRight"></div>
        <RightSidebar />
      </aside>
    </Transition>
    </div>
  </div>
</template>

<style scoped>
.no-drag {
  -webkit-app-region: no-drag;
}

.layout-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg-dark); /* #0A0D18 */
  position: relative;
}

.titlebar-drag-region {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--titlebar-height);
  -webkit-app-region: drag;
  z-index: 5000;
}

.layout {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
  overflow: hidden;
  padding: var(--titlebar-height) var(--chrome-gap) var(--chrome-gap) var(--chrome-gap);
}

/* Left Sidebar */
.left-sidebar {
  width: 260px;
  background-color: var(--bg-dark);
  border-radius: var(--chrome-radius);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding-top: 0;
  margin-right: var(--chrome-gap);
  overflow: hidden;
}

/* Main Content (The Island) */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
  background-color: var(--bg-panel);
  border-radius: var(--chrome-radius);
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04),
    0 4px 20px rgba(0, 0, 0, 0.28);
  transition: padding-top 0.25s ease;
}

/* When sidebar is closed, push content below the macOS traffic lights.
   Panel bg covers full area; only inner content shifts down. */
.left-sidebar-closed .main-content {
  padding-top: 20px;
}

.floating-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background-color: var(--bg-dark); /* #0A0D18 */
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 8px 12px;
}

.chat-breadcrumbs {
  font-size: 0.78rem;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.header-left-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted-dark);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease-out, background-color 0.15s ease-out;
  flex-shrink: 0;
}

.icon-btn:hover {
  background-color: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
}

.icon-btn:active {
  transform: scale(0.96);
}

.chat-breadcrumbs .muted {
  color: var(--text-muted-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.chat-breadcrumbs .divider {
  color: var(--text-muted-dark);
  opacity: 0.45;
  flex-shrink: 0;
}

.chat-breadcrumbs > span:last-child {
  color: var(--text-muted);
  font-weight: 500;
  white-space: nowrap;
}

/* Chat History */
.chat-history {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 140px;
}

.chat-container {
  max-width: 800px;
  width: 100%;
  padding: 0 16px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.welcome-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.9em;
  gap: 24px;
  margin-top: 10vh;
}

.welcome-banner {
  max-width: 300px;
  width: 100%;
  opacity: 0.2;
  filter: grayscale(100%);
  transition: opacity 0.3s;
}

.welcome-banner:hover {
  opacity: 0.5;
}

/* Empty Conversation State */
.empty-conversation-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative; /* For absolute composer */
}

.header-right-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.divider-vertical {
  width: 1px;
  height: 14px;
  background-color: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.bottom-view-toggles {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.bottom-tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted-dark);
  border: none;
  cursor: pointer;
  transition: color 0.15s ease-out, background-color 0.15s ease-out, box-shadow 0.15s ease-out;
}

.bottom-tab-btn:hover {
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.05);
}

.bottom-tab-btn:active {
  transform: scale(0.96);
}

.bottom-tab-btn.active {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.view-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.app-view {
  width: 100%;
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.app-view-hidden {
  position: absolute !important;
  top: -9999px !important;
  left: -9999px !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
}

.global-bottom-bar {
  position: absolute;
  bottom: var(--bottom-bar-offset);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background-color: var(--bg-dark);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 6px 10px;
  z-index: 50;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.22);
}

/* Right Sidebar wrapper */
.right-sidebar {
  /* width is bound inline */
  background-color: transparent; /* Blends with layout-container bg-dark */
  display: flex;
  flex-direction: column;
  z-index: 10;
  position: relative;
}

.resizer {
  position: absolute;
  left: -6px;
  top: 0;
  bottom: 0;
  width: 12px;
  cursor: col-resize;
  z-index: 100;
  transition: background-color 0.2s;
}

.resizer:hover, .resizer.active {
  background-color: rgba(255, 255, 255, 0.1);
}

/* Left Sidebar - Enter/Leave Transition via v-if */
.sidebar-left-enter-active,
.sidebar-left-leave-active {
  transition:
    width 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    margin-right 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
  overflow: hidden;
  white-space: nowrap;
}
.sidebar-left-enter-from,
.sidebar-left-leave-to {
  width: 0;
  margin-right: 0;
  opacity: 0;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
  white-space: nowrap;
}
.slide-right-enter-from,
.slide-right-leave-to {
  width: 0 !important;
  opacity: 0;
  transform: translateX(40px);
  padding-left: 0 !important;
  padding-right: 0 !important;
  margin-left: -8px !important; /* cancel flex gap */
  margin-right: 0 !important;
}
</style>
