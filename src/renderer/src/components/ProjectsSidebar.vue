<script setup lang="ts">
import { ref } from 'vue'

const projects = ref([
  {
    id: 1,
    name: 'kraken',
    items: [
      { id: 101, title: 'Codebase And Skills Ana...', time: 'now', active: true }
    ]
  },
  {
    id: 2,
    name: 'intelligent-bardeen',
    items: [
      { id: 201, title: 'Astro Vercel Docs Site', time: '2d', active: false }
    ]
  },
  {
    id: 3,
    name: 'voice-line',
    items: [
      { id: 301, title: 'Download Project Sourc...', time: '2d', active: false }
    ]
  },
  {
    id: 4,
    name: 'bubbles.space',
    items: [
      { id: 401, title: 'Setup Nuxt With Ollama', time: '15h', active: false }
    ]
  },
  {
    id: 5,
    name: 'www.taohq',
    items: [
      { id: 501, title: 'TaoHQ Codebase Overvi...', time: '3d', active: false }
    ]
  },
  {
    id: 6,
    name: 'web-have-sound',
    items: [
      { id: 601, title: 'Developing A New Skill', time: '4d', active: false },
      { id: 602, title: 'Understanding New Mod...', time: '4d', active: false },
      { id: 603, title: 'Technical Documentatio...', time: '5d', active: false }
    ]
  },
  {
    id: 7,
    name: 'v2.taohq',
    items: [
      { id: 701, title: 'Modern Portfolio Design ...', time: '6d', active: false }
    ]
  }
])
</script>

<template>
  <div class="projects-sidebar">
    <!-- Header -->
    <header class="projects-header">
      <h2 class="title">Projects</h2>
      <div class="header-actions">
        <button class="icon-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
        </button>
        <button class="icon-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
        </button>
      </div>
    </header>

    <!-- Project List -->
    <div class="projects-list">
      <div v-for="project in projects" :key="project.id" class="project-group">
        <!-- Project Folder -->
        <div class="project-folder">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <span class="folder-name">{{ project.name }}</span>
        </div>
        
        <!-- Project Items -->
        <div class="project-items">
          <div 
            v-for="item in project.items" 
            :key="item.id" 
            :class="['project-item', { active: item.active }]"
          >
            <span class="item-title">{{ item.title }}</span>
            <span class="item-time">{{ item.time }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.projects-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: transparent;
  color: var(--text-main);
  overflow: hidden;
}

.projects-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 16px 8px;
  flex-shrink: 0;
}

.title {
  font-size: 0.95em;
  font-weight: 600;
  color: var(--text-muted);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
}

.projects-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 24px 8px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.projects-list::-webkit-scrollbar {
  width: 4px;
}

.projects-list::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.project-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.project-folder {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
  color: var(--text-muted);
}

.folder-name {
  font-size: 0.9em;
  font-weight: 500;
  letter-spacing: 0.2px;
}

.project-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.project-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px 8px 32px; /* Indent to align with folder text */
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.project-item:hover {
  background-color: rgba(255, 255, 255, 0.03);
}

.project-item.active {
  background-color: rgba(255, 255, 255, 0.1); /* Brighter active state */
}

.item-title {
  font-size: 0.85em;
  color: #c9cdd4; /* Slightly brighter than muted */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 12px;
}

.project-item.active .item-title {
  color: #ffffff;
  font-weight: 500;
}

.item-time {
  font-size: 0.75em;
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
