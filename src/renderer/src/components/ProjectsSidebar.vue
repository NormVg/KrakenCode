<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Settings, FolderPlus, Folder, Plus } from 'lucide-vue-next'
import { useProjectsStore } from '../stores/projects'

const emit = defineEmits(['open-settings'])

const projectsStore = useProjectsStore()
const { projects, activeProjectId } = storeToRefs(projectsStore)

const handleCreateChat = (projectId: string) => {
  projectsStore.createChat(projectId)
  projectsStore.activeView = 'agent' // Ensure we're in the Agent view when creating a chat
}
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
            <button class="icon-btn add-chat-btn" title="New Session" @click.stop="handleCreateChat(project.id)">
              <Plus :size="14" stroke-width="2" />
            </button>
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
  padding: 0 4px 24px 8px; /* Reduced right padding */
  display: flex;
  flex-direction: column;
  gap: 20px;
  mask-image: linear-gradient(to bottom, black 95%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 95%, transparent 100%);
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
  padding: 6px 8px;
  color: var(--text-muted-dark);
  cursor: pointer;
  border-radius: 6px;
  margin-bottom: 2px;
}

.project-folder:hover {
  color: var(--text-muted);
}

.active-folder {
  color: var(--text-muted);
}

.folder-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-chat-btn {
  opacity: 0;
  padding: 2px;
  color: var(--text-muted);
}

.project-folder:hover .add-chat-btn {
  opacity: 1;
}

.folder-name {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  padding: 8px 10px 8px 26px; /* Reduced left indent slightly */
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin: 0; /* Removed horizontal margin to use full width */
}

.project-item:hover {
  background-color: rgba(255, 255, 255, 0.04);
}

.project-item.active {
  background-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.item-title {
  font-size: 0.9rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 12px;
  font-weight: 400;
  transition: color 0.2s ease;
}

.project-item:hover .item-title {
  color: #E2E8F0;
}

.project-item.active .item-title {
  color: #FFFFFF;
  font-weight: 500;
}

.item-time {
  font-size: 0.75rem;
  color: var(--text-muted-dark);
  flex-shrink: 0;
  transition: opacity 0.2s;
}

.item-time.hidden,
.project-item:hover .item-time {
  opacity: 0;
  pointer-events: none;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  position: relative;
  flex-shrink: 0;
}

.chat-menu {
  position: relative;
}

.menu-trigger {
  opacity: 0;
  padding: 4px;
  color: var(--text-muted);
  position: absolute;
  right: -4px;
  top: 50%;
  transform: translateY(-50%);
  background-color: var(--bg-dark);
}

.project-item:hover .menu-trigger,
.chat-menu:has(.dropdown-menu) .menu-trigger {
  opacity: 1;
}

.project-item.active .menu-trigger {
  background-color: transparent;
}

.dropdown-menu {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  background-color: var(--bg-panel);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 50;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  min-width: 120px;
}

.dropdown-item {
  background: transparent;
  border: none;
  color: var(--text-main);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  transition: background-color 0.1s;
}

.dropdown-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.dropdown-item.delete {
  color: var(--accent);
}
.dropdown-item.delete:hover {
  background-color: rgba(255, 95, 95, 0.1);
}

.edit-mode {
  width: 100%;
}

.edit-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--accent-purple);
  color: var(--text-main);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.9rem;
  outline: none;
}
</style>
