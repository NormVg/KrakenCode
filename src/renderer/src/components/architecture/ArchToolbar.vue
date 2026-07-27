<script setup lang="ts">
import { Play, Download, Trash2, Maximize, MousePointer2, Network } from 'lucide-vue-next'
import { useArchGraph } from './composables/useArchGraph'
import { useAutoLayout } from './composables/useAutoLayout'

const archGraph = useArchGraph()
const { recompute } = useAutoLayout()

const handleAutoLayout = async () => {
  await recompute('DOWN')
}

const handleClear = () => {
  if (confirm('Clear the entire architecture diagram?')) {
    archGraph.clearGraph()
  }
}
</script>

<template>
  <div class="arch-toolbar">
    <div class="toolbar-left">
      <span class="arch-title">{{ archGraph.title.value }}</span>
    </div>

    <div class="toolbar-center">
      <button class="tool-btn" @click="archGraph.fitView" title="Fit to screen">
        <Maximize :size="14" />
      </button>
      <div class="divider"></div>
      <button class="tool-btn action-btn" @click="handleAutoLayout" title="Auto Layout (elkjs)">
        <Network :size="14" />
        <span>Auto Layout</span>
      </button>
    </div>

    <div class="toolbar-right">
      <button class="tool-btn danger" @click="handleClear" title="Clear Canvas">
        <Trash2 :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.arch-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-color);
  height: 48px;
  box-sizing: border-box;
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(10, 13, 24, 0.4);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px;
  padding: 4px;
}

.arch-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-main);
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-main);
}

.tool-btn.danger:hover {
  background: rgba(255, 95, 95, 0.15);
  color: var(--accent);
}

.tool-btn.action-btn {
  width: auto;
  padding: 0 10px;
  gap: 6px;
}
.tool-btn.action-btn span {
  font-size: 0.75rem;
  font-weight: 500;
}

.divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.1);
}
</style>
