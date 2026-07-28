<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { ServiceNodeData } from '../types/arch.types'

const props = defineProps<{
  data: ServiceNodeData
  selected?: boolean
}>()

const statusColor: Record<string, string> = {
  healthy:  '#08C371',
  degraded: '#F59E0B',
  offline:  '#FF5F5F',
  unknown:  '#9DA1D3',
}

const color = props.data.status
  ? statusColor[props.data.status] ?? statusColor.unknown
  : statusColor.unknown
</script>

<template>
  <div class="arch-node service-node" :class="{ selected }">
    <!-- Connection handles: one per side, works as source OR target -->
    <Handle id="top"    type="source" :position="Position.Top"    class="node-handle" />
    <Handle id="right"  type="source" :position="Position.Right"  class="node-handle" />
    <Handle id="bottom" type="source" :position="Position.Bottom" class="node-handle" />
    <Handle id="left"   type="source" :position="Position.Left"   class="node-handle" />
    
    <div class="node-header">
      <div class="node-icon service-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
          <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
        </svg>
      </div>
      <div class="node-meta">
        <span class="node-label">{{ data.label }}</span>
        <span v-if="data.tech" class="node-tech">{{ data.tech }}</span>
      </div>
      <div class="node-status-dot" :style="{ background: color }" :title="data.status ?? 'unknown'" />
    </div>

    <div v-if="data.description" class="node-desc">{{ data.description }}</div>

</div>
</template>

<style scoped>
.arch-node {
  min-width: 180px;
  max-width: 220px;
  background: #141420;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.2);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  cursor: default;
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

.service-icon {
  background: rgba(147, 116, 190, 0.15);
  color: #9374BE;
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
  color: rgba(255,255,255,0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-tech {
  font-size: 0.68rem;
  color: rgba(255,255,255,0.3);
  font-family: var(--font-code);
}

.node-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background 0.3s ease;
  box-shadow: 0 0 6px currentColor;
}

.node-desc {
  margin-top: 8px;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.3);
  line-height: 1.4;
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 6px;
}

:deep(.arch-handle) {
  width: 8px;
  height: 8px;
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.1);
  transition: background 0.15s ease;
}

:deep(.arch-handle.target-handle) {
  border: none;
  background: transparent;
  pointer-events: none; /* Let source handle take the drag events */
}

:deep(.arch-handle:hover) {
  background: #AA205A;
}
</style>
