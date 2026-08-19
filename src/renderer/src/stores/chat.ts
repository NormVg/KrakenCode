import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useProjectsStore } from './projects'
import type { ChatSession, ChatMessage } from '../types'

export const useChatStore = defineStore('chat', () => {
  const projectsStore = useProjectsStore()

  const activeChat = computed(() => {
    if (!projectsStore.activeProject || !projectsStore.activeChatId) return null
    return projectsStore.activeProject.items.find(c => c.id === projectsStore.activeChatId)
  })

  const createChat = (projectId: string, title: string = 'New Chat') => {
    const project = projectsStore.projects.find(p => p.id === projectId)
    if (!project) return null

    const newChat: ChatSession = {
      id: crypto.randomUUID(),
      title,
      time: 'Just now',
      messages: []
    }
    project.items.unshift(newChat)
    projectsStore.activeProjectId = projectId
    projectsStore.activeChatId = newChat.id
    projectsStore.saveData()
    return newChat
  }

  const selectChat = (projectId: string, chatId: string) => {
    projectsStore.activeProjectId = projectId
    projectsStore.activeChatId = chatId
    projectsStore.saveData()
  }

  const renameChat = (projectId: string, chatId: string, newTitle: string) => {
    const project = projectsStore.projects.find(p => p.id === projectId)
    if (!project) return
    const chat = project.items.find(c => c.id === chatId)
    if (chat) {
      chat.title = newTitle
      projectsStore.saveData()
    }
  }

  const deleteChat = (projectId: string, chatId: string) => {
    const project = projectsStore.projects.find(p => p.id === projectId)
    if (!project) return
    project.items = project.items.filter(c => c.id !== chatId)
    if (projectsStore.activeChatId === chatId) {
      projectsStore.activeChatId = project.items.length > 0 ? project.items[0].id : null
    }
    projectsStore.saveData()
  }

  const addMessageToActiveChat = (msg: ChatMessage) => {
    if (!activeChat.value) return
    
    if (activeChat.value.messages.length === 0 && msg.role === 'user' && activeChat.value.title === 'New Chat') {
      const firstLine = msg.content.split('\n')[0].trim()
      activeChat.value.title = firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine
    }
    
    activeChat.value.messages.push(msg)
    projectsStore.saveData()
  }

  const updateActiveChatStreamingMessage = (chunk: string) => {
    if (!activeChat.value) return
    const msgs = activeChat.value.messages
    if (msgs.length > 0) {
       const last = msgs[msgs.length - 1]
       if (last.role === 'agent' && last.isStreaming) {
         last.content += chunk
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
         projectsStore.saveData()
       }
    }
  }

  const appendErrorToActiveChat = (err: string) => {
    if (!activeChat.value) return
    const msgs = activeChat.value.messages
    if (msgs.length > 0) {
       const last = msgs[msgs.length - 1]
       if (last.role === 'agent') {
         last.content += `\n**Error:** ${err}`
         last.isStreaming = false
         projectsStore.saveData()
       }
    }
  }

  const replaceActiveChatLastAgentContent = (content: string) => {
    if (!activeChat.value) return
    const msgs = activeChat.value.messages
    if (msgs.length === 0) return
    const last = msgs[msgs.length - 1]
    if (last.role !== 'agent') return
    last.content = content
    last.isStreaming = false
    projectsStore.saveData()
  }

  return {
    activeChat,
    createChat,
    selectChat,
    renameChat,
    deleteChat,
    addMessageToActiveChat,
    updateActiveChatStreamingMessage,
    endActiveChatStreamingMessage,
    appendErrorToActiveChat,
    replaceActiveChatLastAgentContent
  }
})
