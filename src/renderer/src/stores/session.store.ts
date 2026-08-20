import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useWorkspaceStore } from './workspace.store'
import type { Session, Message, MessageRole } from '../../../shared/types'

export const useSessionStore = defineStore('session', () => {
  const workspaceStore = useWorkspaceStore()

  const sessions = ref<Session[]>([])
  const messages = ref<Message[]>([])
  const isSessionsLoaded = ref(false)
  const isMessagesLoaded = ref(false)

  // ─── Computed ────────────────────────────────────────────────────────────────

  const activeSession = computed(() => {
    const sessionId = workspaceStore.activeSessionId
    if (!sessionId) return null
    return sessions.value.find((s) => s.id === sessionId) ?? null
  })

  // ─── Sessions ──────────────────────────────────────────────────────────────────

  async function loadSessions(): Promise<void> {
    const wsId = workspaceStore.activeWorkspaceId
    if (!wsId) {
      sessions.value = []
      messages.value = []
      isSessionsLoaded.value = true
      return
    }
    try {
      sessions.value = await window.api.session.getByWorkspace(wsId)
      // Clear messages — the caller will load the active session's messages
      messages.value = []
    } catch (e) {
      console.error('[session] Failed to load sessions:', e)
      sessions.value = []
      messages.value = []
    } finally {
      isSessionsLoaded.value = true
    }
  }

  async function createSession(title: string = 'New Chat'): Promise<Session | null> {
    const wsId = workspaceStore.activeWorkspaceId
    if (!wsId) return null

    const session = await window.api.session.create({
      id: crypto.randomUUID(),
      workspaceId: wsId,
      title
    })

    sessions.value.unshift(session)
    await workspaceStore.setActiveSession(session.id)
    messages.value = []
    return session
  }

  async function selectSession(sessionId: string): Promise<void> {
    await workspaceStore.setActiveSession(sessionId)
    await loadMessages(sessionId)
  }

  async function renameSession(sessionId: string, newTitle: string): Promise<void> {
    await window.api.session.update(sessionId, { title: newTitle })
    const s = sessions.value.find((s) => s.id === sessionId)
    if (s) s.title = newTitle
  }

  async function deleteSession(sessionId: string): Promise<void> {
    await window.api.session.delete(sessionId)
    sessions.value = sessions.value.filter((s) => s.id !== sessionId)

    // Select next session if active was deleted
    if (workspaceStore.activeSessionId === sessionId) {
      const next = sessions.value.length > 0 ? sessions.value[0].id : null
      await workspaceStore.setActiveSession(next)
      if (next) {
        await loadMessages(next)
      } else {
        messages.value = []
      }
    }
  }

  // ─── Messages ─────────────────────────────────────────────────────────────────

  async function loadMessages(sessionId: string): Promise<void> {
    try {
      messages.value = await window.api.message.getBySession(sessionId)
      isMessagesLoaded.value = true
    } catch (e) {
      console.error('[session] Failed to load messages:', e)
      messages.value = []
      isMessagesLoaded.value = true
    }
  }

  async function addMessage(role: MessageRole, content: string, isStreaming = false): Promise<Message | null> {
    const sessionId = workspaceStore.activeSessionId
    if (!sessionId) return null

    const msg = await window.api.message.create({
      id: crypto.randomUUID(),
      sessionId,
      role,
      content,
      isStreaming
    })

    messages.value.push(msg)

    // Auto-title from first user message
    if (role === 'user' && messages.value.length === 1) {
      const firstLine = content.split('\n')[0].trim()
      const title = firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine
      await renameSession(sessionId, title)
    }

    return msg
  }

  async function appendToMessage(messageId: string, chunk: string): Promise<void> {
    await window.api.message.appendContent(messageId, chunk)
    const msg = messages.value.find((m) => m.id === messageId)
    if (msg) msg.content += chunk
  }

  async function finalizeMessage(messageId: string): Promise<void> {
    await window.api.message.update(messageId, { isStreaming: false })
    const msg = messages.value.find((m) => m.id === messageId)
    if (msg) msg.isStreaming = false
  }

  async function appendErrorToMessage(messageId: string, error: string): Promise<void> {
    const msg = messages.value.find((m) => m.id === messageId)
    if (!msg) return
    const newContent = msg.content + `\n**Error:** ${error}`
    await window.api.message.update(messageId, { content: newContent, isStreaming: false })
    msg.content = newContent
    msg.isStreaming = false
  }

  async function replaceMessageContent(messageId: string, content: string): Promise<void> {
    await window.api.message.update(messageId, { content, isStreaming: false })
    const msg = messages.value.find((m) => m.id === messageId)
    if (msg) {
      msg.content = content
      msg.isStreaming = false
    }
  }

  return {
    sessions,
    messages,
    isSessionsLoaded,
    isMessagesLoaded,
    activeSession,
    loadSessions,
    createSession,
    selectSession,
    renameSession,
    deleteSession,
    loadMessages,
    addMessage,
    appendToMessage,
    finalizeMessage,
    appendErrorToMessage,
    replaceMessageContent
  }
})
