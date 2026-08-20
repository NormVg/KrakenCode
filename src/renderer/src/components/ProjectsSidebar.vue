<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { Settings, FolderPlus, Folder, Plus, MessageSquare, MoreHorizontal, Edit2, Trash2 } from 'lucide-vue-next'
import { useWorkspaceStore } from '../stores/workspace.store'
import { useSessionStore } from '../stores/session.store'
import { formatRelativeTime } from '../utils/time'

const emit = defineEmits(['open-settings'])

const workspaceStore = useWorkspaceStore()
const sessionStore = useSessionStore()
const { workspaces, activeWorkspaceId, activeSessionId } = storeToRefs(workspaceStore)
const { loadingSessionId } = storeToRefs(sessionStore)

const activeMenuId = ref<string | null>(null)
const editingChatId = ref<string | null>(null)
const editTitle = ref('')

// Load all sessions on mount
onMounted(async () => {
  await sessionStore.loadAllSessions()
  // Load messages for the active session if any
  const activeSession = workspaceStore.activeWorkspace?.activeSessionId
  if (activeSession) {
    await sessionStore.loadMessages(activeSession)
  }
})

// Handle project folder click — switch workspace and load its active session
const handleSelectProject = async (projectId: string) => {
  if (activeWorkspaceId.value === projectId) return
  await workspaceStore.selectWorkspace(projectId)
  const activeSession = workspaceStore.activeWorkspace?.activeSessionId
  if (activeSession) {
    await sessionStore.loadMessages(activeSession)
  } else {
    sessionStore.messages = []
  }
}

const handleAddChat = async (event: Event, projectId: string) => {
  event.stopPropagation()
  // Select the project first so the session is created in the right workspace
  if (activeWorkspaceId.value !== projectId) {
    await workspaceStore.selectWorkspace(projectId)
  }
  await sessionStore.createSession()
  await workspaceStore.setActiveView('agent')
}

const toggleMenu = (chatId: string) => {
  activeMenuId.value = activeMenuId.value === chatId ? null : chatId
}

const startEdit = (chatId: string, currentTitle: string) => {
  editingChatId.value = chatId
  editTitle.value = currentTitle
  activeMenuId.value = null
}

const saveEdit = async (chatId: string) => {
  if (editTitle.value.trim()) {
    await sessionStore.renameSession(chatId, editTitle.value.trim())
  }
  editingChatId.value = null
}

const handleDelete = async (chatId: string) => {
  await sessionStore.deleteSession(chatId)
  activeMenuId.value = null
}

const closeMenu = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.chat-menu')) {
    activeMenuId.value = null
  }
}

onMounted(() => document.addEventListener('click', closeMenu))
onUnmounted(() => document.removeEventListener('click', closeMenu))
</script>

<template>
  <div class="projects-sidebar">
    <!-- Header — sits in titlebar row beside traffic lights -->
    <header class="projects-header">
      <span class="title">Projects</span>
      <div class="header-actions no-drag">
        <button class="icon-btn" title="Settings" @click="emit('open-settings')">
          <Settings :size="16" stroke-width="2" />
        </button>
        <button class="icon-btn" title="Add Project" @click="workspaceStore.addWorkspace()">
          <FolderPlus :size="16" stroke-width="2" />
        </button>
      </div>
    </header>

    <!-- Project List -->
    <div class="projects-list-wrapper">
      <div class="projects-list">
        <div v-for="project in workspaces" :key="project.id" class="project-group">
          <!-- Project Folder -->
          <div class="project-folder" :class="{ 'active-folder': activeWorkspaceId === project.id }" @click="handleSelectProject(project.id)">
            <div class="folder-title">
              <Folder :size="16" stroke-width="2" />
              <span class="folder-name">{{ project.name }}</span>
            </div>
            <button class="icon-btn add-chat-btn" title="New Session" @click="handleAddChat($event, project.id)">
              <Plus :size="14" stroke-width="2" />
            </button>
          </div>

          <!-- Project Items (Chat Sessions) -->
          <div class="project-items" v-if="sessionStore.sessionsByWorkspace(project.id).length > 0">
            <div
              v-for="item in sessionStore.sessionsByWorkspace(project.id)"
              :key="item.id"
              class="project-item"
              :class="{ 'active': activeSessionId === item.id }"
              @click="sessionStore.selectSession(item.id)"
            >
              <!-- Active indicator bar -->
              <div class="active-bar" v-if="activeSessionId === item.id"></div>

              <div class="item-icon" style="margin-right: 8px; color: var(--text-muted); display: flex; align-items: center; justify-content: center; width: 14px; height: 14px;">
                <!-- Show indicator if working, else show standard chat icon -->
                <div v-if="loadingSessionId === item.id" class="working-indicator">
                  <span class="mini-pixel" v-for="i in 9" :key="i" :style="{ animationDelay: `${(i - 1) * 0.08}s` }"></span>
                </div>
                <MessageSquare v-else :size="14" />
              </div>

              <div class="item-content" style="flex: 1; display: flex; justify-content: space-between; align-items: center; min-width: 0;">
                <div v-if="editingChatId === item.id" class="edit-mode" style="width: 100%;">
                  <input
                    type="text"
                    v-model="editTitle"
                    @keyup.enter="saveEdit(item.id)"
                    @blur="saveEdit(item.id)"
                    @click.stop
                    autofocus
                    class="edit-input"
                  />
                </div>
                <template v-else>
                  <span class="item-title" :class="{ 'is-working': loadingSessionId === item.id }">{{ item.title || 'New Chat' }}</span>
                  <div class="item-meta">
                    <span class="item-time" :class="{'hidden': activeMenuId === item.id || loadingSessionId === item.id}">{{ formatRelativeTime(item.updatedAt) }}</span>
                    <div class="chat-menu">
                      <button class="icon-btn menu-trigger" @click.stop="toggleMenu(item.id)">
                        <MoreHorizontal :size="14" />
                      </button>
                      <div class="dropdown-menu" v-if="activeMenuId === item.id">
                        <button class="dropdown-item" @click.stop="startEdit(item.id, item.title || 'New Chat')">
                          <Edit2 :size="12" /> Rename
                        </button>
                        <button class="dropdown-item delete" @click.stop="handleDelete(item.id)">
                          <Trash2 :size="12" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div v-if="workspaces.length === 0" class="empty-state">
          <p>No projects yet.</p>
          <button class="btn-primary" @click="workspaceStore.addWorkspace()">Add Project</button>
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
  padding: 22px 12px 8px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.title {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted-dark);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
  user-select: none;
}

.header-actions {
  display: flex;
  gap: 2px;
  -webkit-app-region: no-drag;
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
}

.icon-btn:hover {
  background-color: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
}

.icon-btn:active {
  transform: scale(0.96);
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
  align-items: stretch;
  gap: 12px;
  padding: 8px 12px 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9em;
}

.btn-primary {
  width: 100%;
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
  padding: 8px 10px 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin: 0;
  position: relative;
}

.project-item:hover {
  background-color: rgba(255, 255, 255, 0.04);
}

.project-item.active {
  background-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

/* Active session indicator — floating pill */
.active-bar {
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 14px;
  border-radius: 3px;
  background: linear-gradient(180deg, #B197D9, #5EEAD4);
}

/* Working session indicator — mini 3x3 pixel grid */
.working-indicator {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 1px;
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}

.mini-pixel {
  width: 2px;
  height: 2px;
  border-radius: 1px;
  background: #5EEAD4;
  opacity: 0.15;
  animation: mini-pixel-pulse 1.2s ease-in-out infinite;
}

@keyframes mini-pixel-pulse {
  0% { opacity: 0.15; }
  40% { opacity: 1; background: #5EEAD4; }
  60% { opacity: 1; background: #B197D9; }
  100% { opacity: 0.15; }
}

/* Dim the title slightly when working to draw attention to the indicator */
.item-title.is-working {
  color: #E2E8F0;
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
