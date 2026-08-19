import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project, ViewType } from '../types/project'
import { PersistenceService } from '../services/persistence.service'

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const activeProjectId = ref<string | null>(null)
  const activeChatId = ref<string | null>(null)
  const activeView = ref<ViewType>('agent')
  
  const isLoaded = ref(false)

  // Getters
  const activeProject = computed(() => {
    return projects.value.find(p => p.id === activeProjectId.value)
  })

  // Actions
  const loadData = async () => {
    try {
      const data = await PersistenceService.read<any>('kraken_projects')
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
    await PersistenceService.write('kraken_projects', data)
  }

  const addProject = async () => {
    const result = await window.api.dialogOpenDirectory()
    if (result) {
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

  const setProjectArchitecture = (projectId: string, mermaidSource: string) => {
    const project = projects.value.find(p => p.id === projectId)
    if (!project) return
    project.architecture = mermaidSource
    saveData()
  }

  return {
    projects,
    activeProjectId,
    activeChatId,
    activeView,
    activeProject,
    isLoaded,
    loadData,
    saveData,
    addProject,
    setProjectArchitecture
  }
})
