<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { RotateCw, FilePlus, FolderPlus } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '../stores/projects'
import FileTreeNode from './FileTreeNode.vue'

const projectsStore = useProjectsStore()
const { activeProject } = storeToRefs(projectsStore)

const files = ref<any[]>([])
const isDragOverRoot = ref(false)

// Inline creation state
const creatingType = ref<'file' | 'folder' | null>(null)
const creatingInNode = ref<any>(null) // null = root
const newItemName = ref('')
const newItemInputRef = ref<HTMLInputElement | null>(null)

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

// Start inline creation
const startCreate = async (nodeOrObj: any, typeArg?: string) => {
  // Support both (null, 'file') from buttons and ({ node, type }) from tree
  const node = typeArg !== undefined ? nodeOrObj : nodeOrObj?.node
  const type = (typeArg !== undefined ? typeArg : nodeOrObj?.type) as 'file' | 'folder'

  creatingInNode.value = node
  creatingType.value = type
  newItemName.value = ''
  await nextTick()
  newItemInputRef.value?.focus()
}

// Commit the creation on Enter
const commitCreate = async () => {
  const name = newItemName.value.trim()
  if (!name || !creatingType.value) {
    cancelCreate()
    return
  }

  const basePath = creatingInNode.value
    ? creatingInNode.value.path
    : activeProject.value?.path

  if (!basePath) { cancelCreate(); return }

  const fullPath = `${basePath}/${name}`
  await window.api.fs.createItem(fullPath, creatingType.value)

  if (creatingInNode.value) {
    creatingInNode.value.childrenLoaded = false
    creatingInNode.value.isOpen = true
  }

  cancelCreate()
  loadTree()
}

const cancelCreate = () => {
  creatingType.value = null
  creatingInNode.value = null
  newItemName.value = ''
}

const handleRenameItem = async (payload: { node: any; newName: string }) => {
  const { node, newName } = payload
  const segments = node.path.split('/')
  segments.pop()
  segments.push(newName)
  const newPath = segments.join('/')
  await window.api.fs.renameItem(node.path, newPath)
  loadTree()
}

const handleDeleteItem = async (node: any) => {
  await window.api.fs.deleteItem(node.path)
  loadTree()
}


// Drag & drop — root
const onDragOverRoot = () => { isDragOverRoot.value = true }
const onDragLeaveRoot = () => { isDragOverRoot.value = false }

const onDropRoot = async (e: DragEvent) => {
  isDragOverRoot.value = false
  if (!activeProject.value?.path) return

  const targetDir = activeProject.value.path

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
    <!-- Action Bar -->
    <div class="panel-actions">
      <button class="panel-action-btn" @click.stop="startCreate(null, 'file')" title="New File">
        <FilePlus :size="13" />
      </button>
      <button class="panel-action-btn" @click.stop="startCreate(null, 'folder')" title="New Folder">
        <FolderPlus :size="13" />
      </button>
      <button class="panel-action-btn" @click.stop="loadTree" title="Refresh">
        <RotateCw :size="13" />
      </button>
    </div>

    <!-- Inline creation input (shown at root level) -->
    <div v-if="creatingType && !creatingInNode" class="inline-create">
      <span class="inline-create-icon">{{ creatingType === 'folder' ? '📁' : '📄' }}</span>
      <input
        ref="newItemInputRef"
        v-model="newItemName"
        class="inline-create-input"
        :placeholder="`New ${creatingType} name…`"
        @keydown.enter="commitCreate"
        @keydown.esc="cancelCreate"
        @blur="cancelCreate"
      />
    </div>

    <!-- File Tree -->
    <div class="file-tree" v-if="files.length">
      <FileTreeNode
        v-for="(item, index) in files"
        :key="index"
        :node="item"
        :depth="0"
        @open-file="handleOpenFile"
        @create-item="startCreate"
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
  outline: 1px dashed rgba(255, 255, 255, 0.1);
  outline-offset: -2px;
}

.panel-actions {
  display: flex;
  gap: 2px;
  justify-content: flex-end;
  padding: 2px 6px 4px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.panel-action-btn {
  background: transparent;
  border: none;
  color: var(--text-muted-dark);
  cursor: pointer;
  padding: 5px;
  border-radius: 5px;
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

/* Inline creation row */
.inline-create {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  flex-shrink: 0;
}

.inline-create-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.inline-create-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: var(--text-main);
  font-size: 12px;
  font-family: var(--font-primary);
  padding: 3px 7px;
  outline: none;
  -webkit-app-region: no-drag;
  pointer-events: all;
}

.inline-create-input:focus {
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.1);
}

.file-tree {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: auto;
  padding: 0 6px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.file-tree::-webkit-scrollbar {
  display: none;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.muted {
  color: var(--text-muted-dark);
  font-size: 0.8em;
  text-align: center;
}
</style>
