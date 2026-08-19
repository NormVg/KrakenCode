import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useWorkspaceStore } from './workspace.store'
import type { OpenFile } from '../../../shared/types'

export const useEditorStore = defineStore('editor', () => {
  const workspaceStore = useWorkspaceStore()

  const openFiles = ref<OpenFile[]>([])
  const activeFileId = ref<string | null>(null)
  const isLoaded = ref(false)

  // ─── Computed ────────────────────────────────────────────────────────────────

  const activeFile = computed(() =>
    openFiles.value.find((f) => f.id === activeFileId.value) ?? null
  )

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function getLanguageFromExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'ts': case 'tsx': return 'typescript'
      case 'js': case 'jsx': return 'javascript'
      case 'vue': case 'html': return 'html'
      case 'json': return 'json'
      case 'md': return 'markdown'
      case 'css': return 'css'
      case 'scss': case 'sass': return 'scss'
      case 'py': return 'python'
      case 'go': return 'go'
      case 'rs': return 'rust'
      case 'java': return 'java'
      case 'c': case 'h': return 'c'
      case 'cpp': case 'cc': case 'cxx': return 'cpp'
      case 'rb': return 'ruby'
      case 'php': return 'php'
      case 'swift': return 'swift'
      case 'kt': return 'kotlin'
      case 'sh': case 'bash': return 'shell'
      case 'yml': case 'yaml': return 'yaml'
      case 'toml': return 'toml'
      case 'sql': return 'sql'
      case 'xml': return 'xml'
      case 'dockerfile': return 'dockerfile'
      default: return 'plaintext'
    }
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async function loadOpenFiles(): Promise<void> {
    const wsId = workspaceStore.activeWorkspaceId
    if (!wsId) {
      openFiles.value = []
      activeFileId.value = null
      isLoaded.value = true
      return
    }
    try {
      openFiles.value = await window.api.openFile.getByWorkspace(wsId)
      const active = openFiles.value.find((f) => f.isActive)
      activeFileId.value = active?.id ?? (openFiles.value.length > 0 ? openFiles.value[0].id : null)
    } catch (e) {
      console.error('[editor] Failed to load open files:', e)
      openFiles.value = []
    } finally {
      isLoaded.value = true
    }
  }

  async function openFile(node: { name: string; path: string }): Promise<void> {
    const wsId = workspaceStore.activeWorkspaceId
    if (!wsId) return

    // Check if already open
    const existing = openFiles.value.find((f) => f.path === node.path)
    if (existing) {
      await setActiveFile(existing.id)
      await workspaceStore.setActiveView('editor')
      return
    }

    // Read file content from disk
    const content = await window.api.fs.readFile(node.path)

    // Persist to database
    const file = await window.api.openFile.upsert({
      id: node.path,
      workspaceId: wsId,
      path: node.path,
      name: node.name,
      language: getLanguageFromExtension(node.name),
      content,
      isModified: false,
      isActive: true
    })

    openFiles.value.push(file)
    await setActiveFile(file.id)
    await workspaceStore.setActiveView('editor')
  }

  async function setActiveFile(fileId: string): Promise<void> {
    const wsId = workspaceStore.activeWorkspaceId
    if (!wsId) return

    activeFileId.value = fileId
    await window.api.openFile.setActive(wsId, fileId)
  }

  async function closeFile(fileId: string): Promise<void> {
    await window.api.openFile.delete(fileId)
    openFiles.value = openFiles.value.filter((f) => f.id !== fileId)

    if (activeFileId.value === fileId) {
      const next = openFiles.value.length > 0 ? openFiles.value[0].id : null
      if (next) {
        await setActiveFile(next)
      } else {
        activeFileId.value = null
      }
    }
  }

  async function updateFileContent(fileId: string, newContent: string): Promise<void> {
    const file = openFiles.value.find((f) => f.id === fileId)
    if (!file) return
    file.content = newContent
    file.isModified = true
    // Persist content + modified flag to DB (not to disk yet)
    await window.api.openFile.update(fileId, { content: newContent, isModified: true })
  }

  async function saveFile(fileId: string): Promise<void> {
    const file = openFiles.value.find((f) => f.id === fileId)
    if (!file) return
    await window.api.fs.writeFile(file.path, file.content)
    file.isModified = false
    await window.api.openFile.update(fileId, { isModified: false })
  }

  async function renameOpenFile(oldPath: string, newPath: string, newName: string): Promise<void> {
    const file = openFiles.value.find((f) => f.path === oldPath)
    if (!file) return
    // Delete old DB record and create new (path is the ID)
    await window.api.openFile.delete(file.id)
    const wsId = workspaceStore.activeWorkspaceId
    if (!wsId) return
    const newFile = await window.api.openFile.upsert({
      id: newPath,
      workspaceId: wsId,
      path: newPath,
      name: newName,
      language: getLanguageFromExtension(newName),
      content: file.content,
      isModified: file.isModified,
      isActive: activeFileId.value === file.id
    })
    // Replace in array
    const idx = openFiles.value.findIndex((f) => f.id === oldPath)
    if (idx >= 0) openFiles.value[idx] = newFile
    if (activeFileId.value === oldPath) activeFileId.value = newPath
  }

  return {
    openFiles,
    activeFileId,
    isLoaded,
    activeFile,
    loadOpenFiles,
    openFile,
    setActiveFile,
    closeFile,
    updateFileContent,
    saveFile,
    renameOpenFile
  }
})
