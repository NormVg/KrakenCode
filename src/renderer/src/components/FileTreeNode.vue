<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { File, Folder, FolderOpen, ChevronRight, ChevronDown, MoreHorizontal, FilePlus, FolderPlus, Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  node: any
  depth: number
}>()

const emit = defineEmits(['openFile', 'createItem', 'deleteItem', 'renameItem', 'refreshTree'])

const isHovered = ref(false)
const isMenuOpen = ref(false)
const isLoading = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const isDragOver = ref(false)

const toggleFolder = async () => {
  if (props.node.type === 'folder') {
    props.node.isOpen = !props.node.isOpen
    if (props.node.isOpen && !props.node.childrenLoaded) {
      await loadChildren()
    }
  } else {
    emit('openFile', props.node)
  }
}

const loadChildren = async () => {
  isLoading.value = true
  try {
    const rawFiles = await window.api.fs.readDirectory(props.node.path)
    props.node.children = rawFiles.map((f: any) => ({
      ...f,
      isOpen: false,
      children: [],
      childrenLoaded: false
    }))
    props.node.childrenLoaded = true
  } catch (err) {
    console.error('Failed to load folder:', err)
  }
  isLoading.value = false
}

const openMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenu = (e: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    isMenuOpen.value = false
  }
}

const handleAction = (action: string, type?: string) => {
  isMenuOpen.value = false
  if (action === 'create' && type) {
    emit('createItem', { node: props.node, type })
  } else if (action === 'delete') {
    emit('deleteItem', props.node)
  } else if (action === 'rename') {
    emit('renameItem', props.node)
  }
}

const onDragStart = (e: DragEvent) => {
  e.dataTransfer?.setData('application/kraken-file', props.node.path)
}

const onDragOver = (e: DragEvent) => {
  if (props.node.type === 'folder') {
    isDragOver.value = true
  }
}

const onDragEnter = (e: DragEvent) => {
  if (props.node.type === 'folder') {
    isDragOver.value = true
  }
}

const onDragLeave = (e: DragEvent) => {
  isDragOver.value = false
}

const onDrop = async (e: DragEvent) => {
  isDragOver.value = false
  if (props.node.type !== 'folder') return
  
  const targetDir = props.node.path
  
  // Internal move
  const internalData = e.dataTransfer?.getData('application/kraken-file')
  if (internalData) {
    const fileName = internalData.split('/').pop()
    const destPath = `${targetDir}/${fileName}`
    if (internalData !== destPath) {
      await window.api.fs.moveItem(internalData, destPath)
      emit('refreshTree')
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
    emit('refreshTree')
  }
}

onMounted(() => {
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
})
</script>

<template>
  <div class="tree-node">
    <div 
      class="tree-item" 
      draggable="true"
      :style="{ paddingLeft: `${depth * 14 + 6}px` }"
      :class="{ 'drag-over': isDragOver }"
      @click.stop="toggleFolder"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
      @dragstart.stop="onDragStart"
      @dragover.prevent.stop="onDragOver"
      @dragenter.prevent.stop="onDragEnter"
      @dragleave.prevent.stop="onDragLeave"
      @drop.prevent.stop="onDrop"
    >
      <!-- Icons -->
      <div class="item-icon">
        <template v-if="node.type === 'folder'">
          <ChevronDown v-if="node.isOpen" :size="13" class="folder-chevron" />
          <ChevronRight v-else :size="13" class="folder-chevron" />
          <FolderOpen v-if="node.isOpen" :size="14" class="icon-folder" />
          <Folder v-else :size="14" class="icon-folder" />
        </template>
        <template v-else>
          <File :size="13" class="icon-file" />
        </template>
      </div>

      <!-- Name -->
      <span class="item-name">{{ node.name }}</span>

      <!-- 3-dot menu button (always occupies space, only visible on hover) -->
      <div class="menu-wrapper" ref="menuRef">
        <button 
          class="more-btn" 
          :class="{ visible: isHovered || isMenuOpen }"
          @click.stop="openMenu"
          title="More actions"
        >
          <MoreHorizontal :size="14" />
        </button>

        <!-- Custom dropdown -->
        <Transition name="menu-pop">
          <div class="dropdown" v-if="isMenuOpen" @click.stop>
            <template v-if="node.type === 'folder'">
              <button class="dropdown-item" @click="handleAction('create', 'file')">
                <FilePlus :size="13" /> New File
              </button>
              <button class="dropdown-item" @click="handleAction('create', 'folder')">
                <FolderPlus :size="13" /> New Folder
              </button>
              <div class="dropdown-divider"></div>
            </template>
            <button class="dropdown-item" @click="handleAction('rename')">
              <Pencil :size="13" /> Rename
            </button>
            <button class="dropdown-item danger" @click="handleAction('delete')">
              <Trash2 :size="13" /> Delete
            </button>
          </div>
        </Transition>
      </div>
    </div>
    
    <!-- Children -->
    <div v-if="node.type === 'folder' && node.isOpen" class="tree-children">
      <!-- Optional: Indentation guide line -->
      <div class="indent-guide" :style="{ marginLeft: `${depth * 14 + 11}px` }"></div>
      
      <div class="children-content">
        <FileTreeNode 
          v-for="(child, index) in node.children" 
          :key="index"
          :node="child"
          :depth="depth + 1"
          @open-file="$emit('openFile', $event)"
          @create-item="$emit('createItem', $event.node, $event.type)"
          @delete-item="$emit('deleteItem', $event)"
          @rename-item="$emit('renameItem', $event)"
          @refresh-tree="$emit('refreshTree')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-node {
  display: flex;
  flex-direction: column;
}

.tree-item {
  display: flex;
  align-items: center;
  padding: 3px 6px 3px 0;
  border-radius: 5px;
  cursor: pointer;
  color: var(--text-muted);
  transition: background-color 0.12s ease, color 0.12s ease;
  user-select: none;
  position: relative;
  min-height: 24px;
  gap: 0;
  width: max-content;
  min-width: 100%;
}

.tree-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
}

.item-icon {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-right: 5px;
  flex-shrink: 0;
}

.item-name {
  font-size: 0.82em;
  white-space: nowrap;
  flex: 1;
}

/* 3-dot button */
.menu-wrapper {
  position: relative;
  flex-shrink: 0;
}

.more-btn {
  background: transparent;
  border: none;
  color: transparent;
  cursor: pointer;
  padding: 2px 3px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 20px;
  transition: color 0.12s ease, background-color 0.12s ease;
  pointer-events: none;
}

.more-btn.visible {
  color: var(--text-muted);
  pointer-events: all;
}

.more-btn.visible:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
}

/* Dropdown menu */
.dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: #1e1e2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px;
  min-width: 140px;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 5px;
  font-size: 0.82em;
  text-align: left;
  transition: background-color 0.1s ease, color 0.1s ease;
}

.dropdown-item:hover {
  background-color: rgba(255, 255, 255, 0.07);
  color: var(--text-main);
}

.dropdown-item.danger {
  color: #f38ba8;
}

.dropdown-item.danger:hover {
  background-color: rgba(243, 139, 168, 0.1);
  color: #f38ba8;
}

.dropdown-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.07);
  margin: 4px 0;
}

/* Animation */
.menu-pop-enter-active {
  transition: opacity 0.12s ease, transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.menu-pop-leave-active {
  transition: opacity 0.08s ease, transform 0.08s ease;
}
.menu-pop-enter-from,
.menu-pop-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(-4px);
}

/* Indent guide */
.tree-children {
  display: flex;
  flex-direction: row;
}

.indent-guide {
  width: 1px;
  background-color: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  border-radius: 1px;
  margin-right: 0;
  transition: background-color 0.15s ease;
}

.tree-children:hover > .indent-guide {
  background-color: rgba(255, 255, 255, 0.18);
}

.children-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.folder-chevron { color: var(--text-muted); }
.text-blue { color: #4A90E2; }
.text-gray { color: var(--text-muted); }

.icon-folder {
  color: #cbd5e1;
  fill: rgba(203, 213, 225, 0.15);
}

.icon-file {
  color: #94a3b8;
  fill: rgba(148, 163, 184, 0.15);
}

/* Drag and drop */
.tree-item.drag-over {
  background-color: rgba(255, 255, 255, 0.08);
  outline: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}
</style>
