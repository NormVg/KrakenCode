<script setup lang="ts">
import { ref } from 'vue'
import { FileCode2, Folder, ChevronRight, ChevronDown, Plus, Edit2, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  node: any
  depth: number
}>()

const emit = defineEmits(['open-file', 'create-item', 'delete-item', 'rename-item'])

const isHovered = ref(false)

const toggleFolder = async () => {
  if (props.node.type === 'folder') {
    props.node.isOpen = !props.node.isOpen
    if (props.node.isOpen && !props.node.childrenLoaded) {
      // Fetch children
      const children = await window.api.fs.readDirectory(props.node.path)
      props.node.children = children.map(c => ({
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

const handleAction = (action: string, type?: string) => {
  if (action === 'create') emit('create-item', props.node, type)
  if (action === 'rename') emit('rename-item', props.node)
  if (action === 'delete') emit('delete-item', props.node)
}
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
      <div class="item-icon">
        <template v-if="node.type === 'folder'">
          <ChevronDown v-if="node.isOpen" :size="14" class="folder-chevron" />
          <ChevronRight v-else :size="14" class="folder-chevron" />
          <Folder :size="14" class="text-blue" />
        </template>
        <template v-else>
          <FileCode2 :size="14" class="text-gray" />
        </template>
      </div>
      <span class="item-name">{{ node.name }}</span>

      <!-- Hover Actions -->
      <div class="node-actions" v-if="isHovered">
        <template v-if="node.type === 'folder'">
          <button class="action-btn" @click.stop="handleAction('create', 'file')" title="New File"><Plus :size="12" /></button>
          <button class="action-btn" @click.stop="handleAction('create', 'folder')" title="New Folder"><Folder :size="12" /></button>
        </template>
        <button class="action-btn" @click.stop="handleAction('rename')" title="Rename"><Edit2 :size="12" /></button>
        <button class="action-btn" @click.stop="handleAction('delete')" title="Delete"><Trash2 :size="12" /></button>
      </div>
    </div>
    
    <div v-if="node.type === 'folder' && node.isOpen" class="tree-children">
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
</template>

<style scoped>
.tree-node {
  display: flex;
  flex-direction: column;
}

.tree-item {
  display: flex;
  align-items: center;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-main);
  transition: background-color 0.1s ease;
  user-select: none;
  position: relative;
}

.tree-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.item-icon {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 6px;
}

.item-name {
  font-size: 0.85em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.node-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 8px;
}

.action-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
}

.folder-chevron {
  color: var(--text-muted);
}

.text-blue { color: #4A90E2; }
.text-gray { color: var(--text-muted); }

.tree-children {
  display: flex;
  flex-direction: column;
}
</style>
