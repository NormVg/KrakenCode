<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

import { storeToRefs } from 'pinia'
import { useProjectsStore } from '../stores/projects'
import FileTreeNode from './FileTreeNode.vue'

const projectsStore = useProjectsStore()
const { activeProject } = storeToRefs(projectsStore)

const files = ref<any[]>([])

const loadTree = async () => {
  if (activeProject.value?.path) {
    const rawFiles = await window.api.fs.readDirectory(activeProject.value.path)
    files.value = rawFiles.map((f: any) => ({
      ...f,
      isOpen: false,
      children: [],
      childrenLoaded: false
    }))
  } else {
    files.value = []
  }
}

onMounted(() => {
  loadTree()
})

watch(() => activeProject.value?.path, () => {
  loadTree()
})

const handleOpenFile = (node: any) => {
  // Fire event to editor view via projects store or direct event bus
  // For now, let's just use the projectsStore or a custom event bus if one exists.
  // Actually, we can just add an `openFile` action to projectsStore.
  projectsStore.openFile(node)
}

const handleCreateItem = async (node: any, type: string) => {
  const name = prompt(`Enter name for new ${type}:`)
  if (!name) return
  
  const path = `${node ? node.path : activeProject.value?.path}/${name}`
  const success = await window.api.fs.createItem(path, type as 'file' | 'folder')
  if (success) {
    if (node) {
      node.childrenLoaded = false
      node.isOpen = false // force refresh on next open
      // Re-open to fetch
      setTimeout(() => {
        // mock click to trigger fetch
        // toggleFolder(node) is inside FileTreeNode, so we might need a more robust refresh
        // For now, just reload the whole tree if it's the root, or let the user click it again.
      }, 10)
    }
    loadTree() // simple fallback
  }
}

const handleDeleteItem = async (node: any) => {
  if (confirm(`Are you sure you want to delete ${node.name}?`)) {
    await window.api.fs.deleteItem(node.path)
    loadTree()
  }
}

const handleRenameItem = async (node: any) => {
  const newName = prompt(`Enter new name for ${node.name}:`, node.name)
  if (!newName || newName === node.name) return
  
  // Replace the last path segment with the new name
  const segments = node.path.split('/')
  segments.pop()
  segments.push(newName)
  const newPath = segments.join('/')
  
  await window.api.fs.renameItem(node.path, newPath)
  loadTree()
}
</script>

<template>
  <div class="file-explorer-panel">
    <div class="panel-header">
      <h3>File Explorer</h3>
      <button class="icon-btn" @click="loadTree" title="Refresh">
        <!-- Optional refresh icon, omitting for clean UI -->
      </button>
    </div>

    <div class="file-tree" v-if="files.length">
      <FileTreeNode 
        v-for="(item, index) in files" 
        :key="index"
        :node="item"
        :depth="0"
        @open-file="handleOpenFile"
        @create-item="handleCreateItem"
        @delete-item="handleDeleteItem"
        @rename-item="handleRenameItem"
      />
    </div>
    <div class="empty-state" v-else>
      <span class="muted">No project loaded or empty folder.</span>
    </div>
  </div>
</template>

<style scoped>
.file-explorer-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px 8px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 0 4px;
}

.panel-header h3 {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted-dark);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.file-tree {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.tree-node {
  display: flex;
  flex-direction: column;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-main);
  transition: background-color 0.1s ease;
  user-select: none;
}

.tree-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.item-name {
  font-size: 0.85em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-children {
  display: flex;
  flex-direction: column;
}

.indent {
  padding-left: 14px;
}

.item-icon {
  display: flex;
  align-items: center;
  gap: 4px;
}

.folder-chevron {
  color: var(--text-muted);
}

.text-blue { color: #4A90E2; }
.text-gray { color: var(--text-muted); }
</style>
