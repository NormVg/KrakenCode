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

export interface OpenFile {
  id: string;      // The absolute path acts as ID
  name: string;
  path: string;
  language: string;
  isModified: boolean;
  content: string; // Current unsaved content, or empty if not loaded yet
}

export interface Project {
  id: string;
  name: string;
  path: string;
  items: ChatSession[];
  /** Mermaid source for the Architecture (Graph) view — text-first, agent-editable */
  architecture?: string;
}

export type ViewType = 'agent' | 'editor' | 'web' | 'diff' | 'graph' | 'terminal'

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const activeProjectId = ref<string | null>(null)
  const activeChatId = ref<string | null>(null)
  const activeView = ref<ViewType>('agent')
  
  // Editor state
  const openFiles = ref<OpenFile[]>([])
  const activeFileId = ref<string | null>(null)
  
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
        if (data.activeView) activeView.value = data.activeView
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
      activeChatId: activeChatId.value,
      activeView: activeView.value
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

  const renameChat = (projectId: string, chatId: string, newTitle: string) => {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    const chat = project.items.find(c => c.id === chatId)
    if (chat) {
      chat.title = newTitle
      saveData()
    }
  }

  const deleteChat = (projectId: string, chatId: string) => {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    project.items = project.items.filter(c => c.id !== chatId)
    if (activeChatId.value === chatId) {
      activeChatId.value = project.items.length > 0 ? project.items[0].id : null
    }
    saveData()
  }

  // --- File Editor Actions ---
  const getLanguageFromExtension = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'ts': case 'tsx': return 'typescript'
      case 'js': case 'jsx': return 'javascript'
      case 'vue': case 'html': return 'html'
      case 'json': return 'json'
      case 'md': return 'markdown'
      case 'css': return 'css'
      case 'py': return 'python'
      default: return 'plaintext'
    }
  }

  const openFile = async (node: { name: string, path: string }) => {
    const existing = openFiles.value.find(f => f.id === node.path)
    if (existing) {
      activeFileId.value = existing.id
      activeView.value = 'editor'
      return
    }

    // Read content
    const content = await window.api.fs.readFile(node.path)
    
    const newFile: OpenFile = {
      id: node.path,
      name: node.name,
      path: node.path,
      language: getLanguageFromExtension(node.name),
      isModified: false,
      content: content
    }
    
    openFiles.value.push(newFile)
    activeFileId.value = newFile.id
    activeView.value = 'editor'
  }

  const closeFile = (id: string) => {
    openFiles.value = openFiles.value.filter(f => f.id !== id)
    if (activeFileId.value === id) {
      activeFileId.value = openFiles.value.length > 0 ? openFiles.value[0].id : null
    }
  }

  const updateFileContent = (id: string, newContent: string) => {
    const file = openFiles.value.find(f => f.id === id)
    if (file) {
      file.content = newContent
      file.isModified = true
    }
  }

  const saveFile = async (id: string) => {
    const file = openFiles.value.find(f => f.id === id)
    if (file) {
      await window.api.fs.writeFile(file.path, file.content)
      file.isModified = false
    }
  }

  const renameOpenFile = (oldPath: string, newPath: string, newName: string) => {
    const file = openFiles.value.find(f => f.path === oldPath)
    if (file) {
      file.id = newPath
      file.path = newPath
      file.name = newName
      file.language = getLanguageFromExtension(newName)
      // If this was the active file, update the active ID too
      if (activeFileId.value === oldPath) {
        activeFileId.value = newPath
      }
    }
  }

  // --- Architecture (Mermaid) ---
  const setProjectArchitecture = (projectId: string, mermaidSource: string) => {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    project.architecture = mermaidSource
    saveData()
  }

  /** Replace the final streaming agent message content (e.g. after stripping fences). */
  const replaceActiveChatLastAgentContent = (content: string) => {
    if (!activeChat.value) return
    const msgs = activeChat.value.messages
    if (msgs.length === 0) return
    const last = msgs[msgs.length - 1]
    if (last.role !== 'agent') return
    last.content = content
    last.isStreaming = false
    saveData()
  }

  return {
    projects,
    activeProjectId,
    activeChatId,
    activeView,
    activeProject,
    activeChat,
    openFiles,
    activeFileId,
    isLoaded,
    loadData,
    saveData,
    addProject,
    createChat,
    selectChat,
    renameChat,
    deleteChat,
    addMessageToActiveChat,
    updateActiveChatStreamingMessage,
    endActiveChatStreamingMessage,
    appendErrorToActiveChat,
    openFile,
    closeFile,
    updateFileContent,
    saveFile,
    renameOpenFile,
    setProjectArchitecture,
    replaceActiveChatLastAgentContent,
  }
})
