import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { OpenFile } from '../types'
import { FileSystemService } from '../services/filesystem.service'
import { useProjectsStore } from './projects'

export const useEditorStore = defineStore('editor', () => {
  const projectsStore = useProjectsStore()
  
  const openFiles = ref<OpenFile[]>([])
  const activeFileId = ref<string | null>(null)

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
      projectsStore.activeView = 'editor'
      return
    }

    const content = await FileSystemService.readFile(node.path)
    
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
    projectsStore.activeView = 'editor'
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
      await FileSystemService.writeFile(file.path, file.content)
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
      if (activeFileId.value === oldPath) {
        activeFileId.value = newPath
      }
    }
  }

  return {
    openFiles,
    activeFileId,
    openFile,
    closeFile,
    updateFileContent,
    saveFile,
    renameOpenFile
  }
})
