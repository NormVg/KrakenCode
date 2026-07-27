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
  padding: 0 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h3 {
  font-size: 0.85em;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.file-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.tree-node {
  display: flex;
  flex-direction: column;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-main);
  transition: background-color 0.2s;
  font-size: 0.85em;
}

.tree-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.item-icon {
  display: flex;
  align-items: center;
  gap: 4px;
}

.item-icon.indent {
  margin-left: 18px;
}

.folder-chevron {
  color: var(--text-muted);
}

.text-blue { color: #4A90E2; }
.text-gray { color: var(--text-muted); }
</style>
