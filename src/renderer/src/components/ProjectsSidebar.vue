<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Settings, FolderPlus, Folder, Plus, Trash2 } from 'lucide-vue-next'
import { useProjectsStore } from '../stores/projects'

const emit = defineEmits(['open-settings'])

const projectsStore = useProjectsStore()
const { projects, activeProjectId, activeChatId } = storeToRefs(projectsStore)
</script>

<template>
  <div class="projects-sidebar">
    <!-- Header -->
    <header class="projects-header">
      <h2 class="title">Projects</h2>
      <div class="header-actions">
        <button class="icon-btn" title="Settings" @click="emit('open-settings')">
          <Settings :size="16" stroke-width="2" />
        </button>
        <button class="icon-btn" title="Add Project" @click="projectsStore.addProject()">
          <FolderPlus :size="16" stroke-width="2" />
        </button>
      </div>
    </header>

    <!-- Project List -->
    <div class="projects-list-wrapper">
      <div class="projects-list">
        <div v-for="project in projects" :key="project.id" class="project-group">
          <!-- Project Folder -->
          <div class="project-folder" :class="{ 'active-folder': activeProjectId === project.id }" @click="projectsStore.activeProjectId = project.id; projectsStore.saveData()">
            <div class="folder-title">
              <Folder :size="16" stroke-width="2" />
              <span class="folder-name">{{ project.name }}</span>
            </div>
            <button class="icon-btn add-chat-btn" title="New Chat" @click.stop="projectsStore.createChat(project.id)">
              <Plus :size="14" stroke-width="2" />
            </button>
          </div>
        
          <!-- Project Items -->
          <div class="project-items" v-show="project.items.length > 0">
            <div 
              v-for="item in project.items" 
              :key="item.id" 
              :class="['project-item', { active: activeChatId === item.id }]"
              @click="projectsStore.selectChat(project.id, item.id)"
            >
              <span class="item-title">{{ item.title || 'New Chat' }}</span>
              <span class="item-time">{{ item.time }}</span>
            </div>
          </div>
        </div>
        
        <div v-if="projects.length === 0" class="empty-state">
          <p>No projects yet.</p>
          <button class="btn-primary" @click="projectsStore.addProject()">Add Project</button>
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
  background-color: transparent;
  color: var(--text-main);
  opacity: 1;
}

.projects-list-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.projects-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 24px 8px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  mask-image: linear-gradient(to bottom, black 95%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 95%, transparent 100%);
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
  justify-content: space-between;
  padding: 4px 8px;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
}

.project-folder:hover {
  background-color: rgba(255, 255, 255, 0.03);
}

.active-folder {
  color: var(--text-main);
}

.folder-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.add-chat-btn {
  opacity: 0;
  padding: 2px;
}

.project-folder:hover .add-chat-btn {
  opacity: 1;
}

.folder-name {
  font-size: 0.9em;
  font-weight: 500;
  letter-spacing: 0.2px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9em;
}

.btn-primary {
  background-color: rgba(255, 255, 255, 0.03);
  color: var(--text-main);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.9em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease-out;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1);
}

.btn-primary:hover {
  background-color: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

.btn-primary:active {
  transform: scale(0.96);
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
