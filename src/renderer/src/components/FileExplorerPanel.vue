<script setup lang="ts">
import { ref } from 'vue'
import { FileCode2, Folder, ChevronRight, ChevronDown } from 'lucide-vue-next'
// Mock file tree data for now
const files = ref([
  {
    name: 'src',
    type: 'folder',
    isOpen: true,
    children: [
      { name: 'main.ts', type: 'file' },
      { name: 'App.vue', type: 'file' },
      {
        name: 'components',
        type: 'folder',
        isOpen: false,
        children: [
          { name: 'HelloWorld.vue', type: 'file' }
        ]
      }
    ]
  },
  { name: 'package.json', type: 'file' },
  { name: 'README.md', type: 'file' }
])

const toggleFolder = (folder: any) => {
  if (folder.type === 'folder') {
    folder.isOpen = !folder.isOpen
  }
}
</script>

<template>
  <div class="file-explorer-panel">
    <div class="panel-header">
      <h3>File Explorer</h3>
    </div>

    <div class="file-tree">
      <div v-for="(item, index) in files" :key="index" class="tree-node">
        <div 
          class="tree-item" 
          :class="{ 'is-folder': item.type === 'folder' }"
          @click="toggleFolder(item)"
        >
          <div class="item-icon">
            <template v-if="item.type === 'folder'">
              <ChevronDown v-if="item.isOpen" :size="14" class="folder-chevron" />
              <ChevronRight v-else :size="14" class="folder-chevron" />
              <Folder :size="14" class="text-blue" />
            </template>
            <template v-else>
              <FileCode2 :size="14" class="text-gray" />
            </template>
          </div>
          <span class="item-name">{{ item.name }}</span>
        </div>
        
        <div v-if="item.type === 'folder' && item.isOpen" class="tree-children">
          <div v-for="(child, childIndex) in item.children" :key="childIndex" class="tree-item">
            <div class="item-icon indent">
              <FileCode2 :size="14" class="text-gray" />
            </div>
            <span class="item-name">{{ child.name }}</span>
          </div>
        </div>
      </div>
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
