<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { RotateCw, FilePlus, FolderPlus } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '../stores/projects'
import FileTreeNode from './FileTreeNode.vue'

const projectsStore = useProjectsStore()
const { activeProject } = storeToRefs(projectsStore)

const files = ref<any[]>([])
const isDragOverRoot = ref(false)

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
  projectsStore.openFile(node)
}

const handleCreateItem = async (nodeOrObj: any, typeArg?: string) => {
  // When called from root buttons: (null, 'file'/'folder')
  // When called from tree node emit: ({ node, type })
  const node = typeArg !== undefined ? nodeOrObj : nodeOrObj?.node
  const type = typeArg !== undefined ? typeArg : nodeOrObj?.type

  const name = prompt(`Enter name for new ${type}:`)
  if (!name) return
  
  const path = `${node ? node.path : activeProject.value?.path}/${name}`
  const success = await window.api.fs.createItem(path, type as 'file' | 'folder')
  if (success) {
    if (node) {
      node.childrenLoaded = false
      node.isOpen = false 
    }
    loadTree() 
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
  
  const segments = node.path.split('/')
  segments.pop()
  segments.push(newName)
  const newPath = segments.join('/')
  
  await window.api.fs.renameItem(node.path, newPath)
  loadTree()
}

const onDragOverRoot = (e: DragEvent) => {
  isDragOverRoot.value = true
}

const onDragLeaveRoot = (e: DragEvent) => {
  isDragOverRoot.value = false
}

const onDropRoot = async (e: DragEvent) => {
  isDragOverRoot.value = false
  if (!activeProject.value?.path) return

  const targetDir = activeProject.value.path
  
  // Internal move
  const internalData = e.dataTransfer?.getData('application/kraken-file')
  if (internalData) {
    const fileName = internalData.split('/').pop()
    const destPath = `${targetDir}/${fileName}`
    if (internalData !== destPath) {
      await window.api.fs.moveItem(internalData, destPath)
      loadTree()
    }
    return
  }
  
  // External copy
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i]
      const sourcePath = (file as any).path
      if (sourcePath) {
        await window.api.fs.copyItem(sourcePath, `${targetDir}/${file.name}`)
      }
    }
    loadTree()
  }
}
</script>

<template>
  <div 
    class="file-explorer-panel"
    @dragover.prevent="onDragOverRoot"
    @dragleave.prevent="onDragLeaveRoot"
    @drop.prevent="onDropRoot"
    :class="{ 'drag-over-root': isDragOverRoot }"
  >
    <div class="panel-actions">
      <button class="panel-action-btn" @click.stop="handleCreateItem(null, 'file')" title="New File">
        <FilePlus :size="13" />
      </button>
      <button class="panel-action-btn" @click.stop="handleCreateItem(null, 'folder')" title="New Folder">
        <FolderPlus :size="13" />
      </button>
      <button class="panel-action-btn" @click.stop="loadTree" title="Refresh">
        <RotateCw :size="13" />
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
        @refresh-tree="loadTree"
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
  padding: 4px 0 0;
  position: relative;
  transition: background-color 0.15s ease;
}

.file-explorer-panel.drag-over-root {
  background-color: rgba(255, 255, 255, 0.03);
}

.panel-actions {
  display: flex;
  gap: 2px;
  justify-content: flex-end;
  padding: 4px 2px 4px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.panel-action-btn {
  background: transparent;
  border: none;
  color: var(--text-muted-dark);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease-out, background-color 0.15s ease-out;
  -webkit-app-region: no-drag;
  pointer-events: all;
}

.panel-action-btn:hover {
  background-color: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
}

.panel-action-btn:active {
  transform: scale(0.96);
}

.file-tree {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: auto;
  padding: 0 6px;
  /* Hide scrollbar */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.file-tree::-webkit-scrollbar {
  display: none;
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
