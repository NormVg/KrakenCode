<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { ExternalNodeData } from '../types/arch.types'
import { Globe } from 'lucide-vue-next'

const props = defineProps<{
  data: ExternalNodeData
  selected?: boolean
}>()
</script>

<template>
  <div class="arch-node external-node" :class="{ selected }">
    <Handle type="target" :position="Position.Top" class="arch-handle" />

    <div class="node-header">
      <div class="node-icon external-icon">
        <Globe :size="16" />
      </div>
      <div class="node-meta">
        <span class="node-label">{{ data.label }}</span>
        <span v-if="data.url" class="node-url">{{ data.url }}</span>
      </div>
    </div>
    
    <div v-if="data.description" class="node-desc">{{ data.description }}</div>

    <Handle type="source" :position="Position.Bottom" class="arch-handle" />
    <Handle type="source" :position="Position.Right" class="arch-handle arch-handle-right" />
    <Handle type="target" :position="Position.Left" class="arch-handle arch-handle-left" />
  </div>
</template>

<style scoped>
.arch-node {
  min-width: 160px;
  max-width: 200px;
  background: #1C1C2A; /* Slightly lighter than regular nodes */
  border: 1px dashed rgba(255,255,255,0.15); /* Dashed border implies external */
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.arch-node.selected {
  border-color: rgba(170, 32, 90, 0.6);
  box-shadow: 0 0 0 2px rgba(170, 32, 90, 0.25), 0 4px 16px rgba(0,0,0,0.5);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  flex-shrink: 0;
}

.external-icon {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
}

.node-meta {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 1px;
}

.node-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(255,255,255,0.7); /* Slightly dimmer */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-url {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.3);
  font-family: var(--font-code);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-desc {
  margin-top: 8px;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.3);
  line-height: 1.4;
  border-top: 1px dashed rgba(255,255,255,0.05);
  padding-top: 6px;
}

:deep(.arch-handle) {
  width: 8px;
  height: 8px;
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.1);
  transition: background 0.15s ease;
}

:deep(.arch-handle:hover) {
  background: #AA205A;
}
</style>
