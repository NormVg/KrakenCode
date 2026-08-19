import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Workspace, ViewType, CreateWorkspaceInput, UpdateWorkspaceInput } from '../../../shared/types'

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaces = ref<Workspace[]>([])
  const activeWorkspaceId = ref<string | null>(null)
  const isLoaded = ref(false)

  // ─── Computed ────────────────────────────────────────────────────────────────

  const activeWorkspace = computed(() =>
    workspaces.value.find((w) => w.id === activeWorkspaceId.value) ?? null
  )

  const activeView = computed<ViewType>(() => activeWorkspace.value?.activeView ?? 'agent')

  const activeSessionId = computed(() => activeWorkspace.value?.activeSessionId ?? null)

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async function loadWorkspaces(): Promise<void> {
    try {
      workspaces.value = await window.api.workspace.getAll()
      if (workspaces.value.length > 0 && !activeWorkspaceId.value) {
        activeWorkspaceId.value = workspaces.value[0].id
      }
    } catch (e) {
      console.error('[workspace] Failed to load workspaces:', e)
    } finally {
      isLoaded.value = true
    }
  }

  async function addWorkspace(): Promise<Workspace | null> {
    const result = await window.api.dialog.openDirectory()
    if (!result) return null

    // Check if workspace already exists by path
    const existing = workspaces.value.find((w) => w.path === result.path)
    if (existing) {
      await selectWorkspace(existing.id)
      return existing
    }

    const input: CreateWorkspaceInput = {
      id: crypto.randomUUID(),
      name: result.name,
      path: result.path
    }

    const workspace = await window.api.workspace.create(input)
    workspaces.value.unshift(workspace)
    await selectWorkspace(workspace.id)
    return workspace
  }

  async function selectWorkspace(id: string): Promise<void> {
    activeWorkspaceId.value = id
    await window.api.workspace.touch(id)
    // Update lastOpenedAt in local state
    const ws = workspaces.value.find((w) => w.id === id)
    if (ws) ws.lastOpenedAt = Date.now()
    // Re-sort by lastOpenedAt
    workspaces.value.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
  }

  async function updateWorkspace(id: string, data: UpdateWorkspaceInput): Promise<void> {
    const updated = await window.api.workspace.update(id, data)
    const idx = workspaces.value.findIndex((w) => w.id === id)
    if (idx >= 0 && updated) {
      workspaces.value[idx] = updated
    }
  }

  async function setActiveView(view: ViewType): Promise<void> {
    if (!activeWorkspaceId.value) return
    await updateWorkspace(activeWorkspaceId.value, { activeView: view })
  }

  async function setActiveSession(sessionId: string | null): Promise<void> {
    if (!activeWorkspaceId.value) return
    await updateWorkspace(activeWorkspaceId.value, { activeSessionId: sessionId })
  }

  async function setArchitecture(mermaidSource: string): Promise<void> {
    if (!activeWorkspaceId.value) return
    await updateWorkspace(activeWorkspaceId.value, { architecture: mermaidSource })
  }

  async function setScratchpadContent(content: string): Promise<void> {
    if (!activeWorkspaceId.value) return
    await updateWorkspace(activeWorkspaceId.value, { scratchpadContent: content })
  }

  async function deleteWorkspace(id: string): Promise<void> {
    await window.api.workspace.delete(id)
    workspaces.value = workspaces.value.filter((w) => w.id !== id)
    if (activeWorkspaceId.value === id) {
      activeWorkspaceId.value = workspaces.value.length > 0 ? workspaces.value[0].id : null
    }
  }

  return {
    workspaces,
    activeWorkspaceId,
    isLoaded,
    activeWorkspace,
    activeView,
    activeSessionId,
    loadWorkspaces,
    addWorkspace,
    selectWorkspace,
    updateWorkspace,
    setActiveView,
    setActiveSession,
    setArchitecture,
    setScratchpadContent,
    deleteWorkspace
  }
})
