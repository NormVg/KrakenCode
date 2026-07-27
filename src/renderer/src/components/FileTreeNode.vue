<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { FileCode2, Folder, ChevronRight, ChevronDown, MoreHorizontal, FilePlus, FolderPlus, Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  node: any
  depth: number
}>()

const emit = defineEmits(['open-file', 'create-item', 'delete-item', 'rename-item'])

const isHovered = ref(false)
const isMenuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)

const toggleFolder = async () => {
  if (props.node.type === 'folder') {
    props.node.isOpen = !props.node.isOpen
    if (props.node.isOpen && !props.node.childrenLoaded) {
      const children = await window.api.fs.readDirectory(props.node.path)
      props.node.children = children.map((c: any) => ({
        ...c,
        isOpen: false,
        children: [],
        childrenLoaded: false
      }))
      props.node.childrenLoaded = true
    }
  } else {
    emit('open-file', props.node)
  }
}

const openMenu = (e: MouseEvent) => {
  e.stopPropagation()
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenu = () => {
  isMenuOpen.value = false
}

const handleAction = (action: string, type?: string) => {
  closeMenu()
  if (action === 'create') emit('create-item', props.node, type)
  if (action === 'rename') emit('rename-item', props.node)
  if (action === 'delete') emit('delete-item', props.node)
}

const onClickOutside = (e: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    closeMenu()
  }
}

onMounted(() => document.addEventListener('click', onClickOutside, true))
onUnmounted(() => document.removeEventListener('click', onClickOutside, true))
</script>

<template>
  <div class="tree-node">
    <div 
      class="tree-item" 
      :style="{ paddingLeft: `${depth * 14 + 6}px` }"
      @click.stop="toggleFolder"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <!-- Icons -->
      <div class="item-icon">
        <template v-if="node.type === 'folder'">
          <ChevronDown v-if="node.isOpen" :size="13" class="folder-chevron" />
          <ChevronRight v-else :size="13" class="folder-chevron" />
          <Folder :size="13" class="text-blue" />
        </template>
        <template v-else>
          <FileCode2 :size="13" class="text-gray" />
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
    
    <!-- Children with indent guide -->
    <div v-if="node.type === 'folder' && node.isOpen" class="tree-children" :style="{ paddingLeft: `${depth * 14 + 13}px` }">
      <div class="indent-guide"></div>
      <div class="children-content">
        <FileTreeNode 
          v-for="(child, index) in node.children" 
          :key="index"
          :node="child"
          :depth="depth + 1"
          @open-file="(n) => emit('open-file', n)"
          @create-item="(n, t) => emit('create-item', n, t)"
          @delete-item="(n) => emit('delete-item', n)"
          @rename-item="(n) => emit('rename-item', n)"
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
</style>
