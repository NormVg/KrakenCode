import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ChatMessage {
  id?: string;
  role: 'user' | 'agent';
  content: string;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  time: string; // e.g. "Just now" or Date string
  messages: ChatMessage[];
}

export interface Project {
  id: string;
  name: string;
  path: string;
  items: ChatSession[];
}

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const activeProjectId = ref<string | null>(null)
  const activeChatId = ref<string | null>(null)
  const isLoaded = ref(false)

  // Getters
  const activeProject = computed(() => {
    return projects.value.find(p => p.id === activeProjectId.value)
  })

  const activeChat = computed(() => {
    if (!activeProject.value || !activeChatId.value) return null
    return activeProject.value.items.find(c => c.id === activeChatId.value)
  })

  // Actions
  const loadData = async () => {
    try {
      const data = await window.api.storeRead('kraken_projects')
      if (data && data.projects) {
        projects.value = data.projects
        activeProjectId.value = data.activeProjectId || (projects.value.length > 0 ? projects.value[0].id : null)
        activeChatId.value = data.activeChatId || null
      }
      isLoaded.value = true
    } catch (e) {
      console.error('Failed to load project data', e)
      isLoaded.value = true
    }
  }

  const saveData = async () => {
    if (!isLoaded.value) return
    const data = {
      projects: projects.value,
      activeProjectId: activeProjectId.value,
      activeChatId: activeChatId.value
    }
    await window.api.storeWrite('kraken_projects', data)
  }

  const addProject = async () => {
    const result = await window.api.dialogOpenDirectory()
    if (result) {
      // Check if project already exists
      const existing = projects.value.find(p => p.path === result.path)
      if (existing) {
        activeProjectId.value = existing.id
        saveData()
        return existing
      }

      const newProject: Project = {
        id: crypto.randomUUID(),
        name: result.name,
        path: result.path,
        items: []
      }
      projects.value.push(newProject)
      activeProjectId.value = newProject.id
      saveData()
      return newProject
    }
    return null
  }

  const createChat = (projectId: string, title: string = 'New Chat') => {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return null

    const newChat: ChatSession = {
      id: crypto.randomUUID(),
      title,
      time: 'Just now',
      messages: []
    }
    project.items.unshift(newChat) // Add to top
    activeProjectId.value = projectId
    activeChatId.value = newChat.id
    saveData()
    return newChat
  }

  const selectChat = (projectId: string, chatId: string) => {
    activeProjectId.value = projectId
    activeChatId.value = chatId
    saveData()
  }
  
  const addMessageToActiveChat = (msg: ChatMessage) => {
    if (!activeChat.value) return
    
    // Auto-update title on first user message
    if (activeChat.value.messages.length === 0 && msg.role === 'user' && activeChat.value.title === 'New Chat') {
      const firstLine = msg.content.split('\n')[0].trim()
      activeChat.value.title = firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine
    }
    
    activeChat.value.messages.push(msg)
    saveData()
  }
  
  const updateActiveChatStreamingMessage = (chunk: string) => {
    if (!activeChat.value) return
    const msgs = activeChat.value.messages
    if (msgs.length > 0) {
       const last = msgs[msgs.length - 1]
       if (last.role === 'agent' && last.isStreaming) {
         last.content += chunk
         // Not calling saveData on every chunk for performance, call on end.
       }
    }
  }

  const endActiveChatStreamingMessage = () => {
    if (!activeChat.value) return
    const msgs = activeChat.value.messages
    if (msgs.length > 0) {
       const last = msgs[msgs.length - 1]
       if (last.role === 'agent') {
         last.isStreaming = false
         saveData()
       }
    }
  }

  const appendErrorToActiveChat = (err: string) => {
    if (!activeChat.value) return
    const msgs = activeChat.value.messages
    if (msgs.length > 0) {
       const last = msgs[msgs.length - 1]
       if (last.role === 'agent') {
         last.content += `\\n**Error:** ${err}`
         last.isStreaming = false
         saveData()
       }
    }
  }

  return {
    projects,
    activeProjectId,
    activeChatId,
    activeProject,
    activeChat,
    isLoaded,
    loadData,
    saveData,
    addProject,
    createChat,
    selectChat,
    addMessageToActiveChat,
    updateActiveChatStreamingMessage,
    endActiveChatStreamingMessage,
    appendErrorToActiveChat
  }
})
