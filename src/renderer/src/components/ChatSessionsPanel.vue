<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { MessageSquare, Plus, Trash2, MoreHorizontal, Edit2 } from 'lucide-vue-next'
import { useProjectsStore } from '../stores/projects'

const projectsStore = useProjectsStore()
const { activeProject, activeChatId } = storeToRefs(projectsStore)

const activeMenuId = ref<string | null>(null)
const editingChatId = ref<string | null>(null)
const editTitle = ref('')

const activeChatSessions = computed(() => {
  return activeProject.value?.items || []
})

const toggleMenu = (chatId: string) => {
  activeMenuId.value = activeMenuId.value === chatId ? null : chatId
}

const startEdit = (chatId: string, title: string) => {
  editingChatId.value = chatId
  editTitle.value = title
  activeMenuId.value = null
}

const saveEdit = (projectId: string, chatId: string) => {
  if (editTitle.value.trim()) {
    projectsStore.renameChat(projectId, chatId, editTitle.value.trim())
  }
  editingChatId.value = null
}

const handleDelete = (projectId: string, chatId: string) => {
  projectsStore.deleteChat(projectId, chatId)
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
  <div class="chat-sessions-panel">
    <div class="panel-header">
      <h3>Agent Sessions</h3>
      <button class="icon-btn add-btn" title="New Chat" @click="activeProject && projectsStore.createChat(activeProject.id)">
        <Plus :size="14" stroke-width="2" />
      </button>
    </div>

    <div class="sessions-list" v-if="activeProject">
      <div 
        v-for="item in activeChatSessions" 
        :key="item.id" 
        :class="['session-item', { active: activeChatId === item.id }]"
        @click="projectsStore.selectChat(activeProject.id, item.id)"
      >
        <div class="item-icon">
          <MessageSquare :size="14" />
        </div>
        
        <div class="item-content">
          <div v-if="editingChatId === item.id" class="edit-mode">
            <input 
              type="text" 
              v-model="editTitle" 
              @keyup.enter="saveEdit(activeProject.id, item.id)"
              @blur="saveEdit(activeProject.id, item.id)"
              @click.stop
              autofocus
              class="edit-input"
            />
          </div>
          <template v-else>
            <span class="item-title">{{ item.title || 'New Chat' }}</span>
            <div class="item-meta">
              <span class="item-time" :class="{'hidden': activeMenuId === item.id}">{{ item.time }}</span>
              <div class="chat-menu">
                <button class="icon-btn menu-trigger" @click.stop="toggleMenu(item.id)">
                  <MoreHorizontal :size="14" />
                </button>
                <div class="dropdown-menu" v-if="activeMenuId === item.id">
                  <button class="dropdown-item" @click.stop="startEdit(item.id, item.title || 'New Chat')">
                    <Edit2 :size="12" /> Rename
                  </button>
                  <button class="dropdown-item delete" @click.stop="handleDelete(activeProject.id, item.id)">
                    <Trash2 :size="12" /> Delete
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <p>Select a Workspace to view sessions.</p>
    </div>
  </div>
</template>

<style scoped>
.chat-sessions-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h3 {
  font-size: 0.85em;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.session-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.session-item.active {
  background-color: rgba(255, 255, 255, 0.1);
}

.session-item.active .item-icon {
  color: var(--text-main);
}

.item-icon {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0; /* for truncation */
}

.item-title {
  font-size: 0.85em;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 8px;
}

.item-meta {
  display: flex;
  align-items: center;
  position: relative;
}

.item-time {
  font-size: 0.7em;
  color: var(--text-muted);
  white-space: nowrap;
  transition: opacity 0.2s ease;
}

.item-time.hidden {
  opacity: 0;
}

.chat-menu {
  position: absolute;
  right: 0;
  display: flex;
  align-items: center;
}

.menu-trigger {
  opacity: 0;
  padding: 2px;
}

.session-item:hover .menu-trigger,
.session-item.active .menu-trigger,
.menu-trigger:focus-within {
  opacity: 1;
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
  z-index: 100;
  min-width: 120px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  color: var(--text-main);
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8em;
  text-align: left;
  transition: background-color 0.2s;
}

.dropdown-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.dropdown-item.delete {
  color: #ff4a4a;
}
.dropdown-item.delete:hover {
  background-color: rgba(255, 74, 74, 0.1);
}

.edit-mode {
  flex: 1;
}

.edit-input {
  width: 100%;
  background-color: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--primary-color, #4A90E2);
  border-radius: 4px;
  color: var(--text-main);
  font-size: 0.85em;
  padding: 4px 8px;
  outline: none;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 0.85em;
}
</style>
