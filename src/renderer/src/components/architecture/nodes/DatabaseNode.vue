<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { DatabaseNodeData } from '../types/arch.types'

const props = defineProps<{
  data: DatabaseNodeData
  selected?: boolean
}>()

const dbColor: Record<string, string> = {
  relational:  '#3B82F6',
  document:    '#10B981',
  'key-value': '#F59E0B',
  graph:       '#8B5CF6',
  vector:      '#EC4899',
}

const accent = props.data.dbType ? dbColor[props.data.dbType] ?? '#9DA1D3' : '#3B82F6'
</script>

<template>
  <div class="arch-node db-node" :class="{ selected }" :style="{ '--db-accent': accent }">
    
    <div class="node-header">
      <div class="node-icon db-icon">
        <!-- Database cylinder icon -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        </svg>
      </div>
      <div class="node-meta">
        <span class="node-label">{{ data.label }}</span>
        <span v-if="data.tech" class="node-tech">{{ data.tech }}</span>
      </div>
    </div>

    <div v-if="data.dbType" class="db-type-badge">{{ data.dbType }}</div>
    <div v-if="data.description" class="node-desc">{{ data.description }}</div>

              
    <!-- Top Handles -->
    <Handle type="source" :position="Position.Top" id="top-s" class="arch-handle" />
    <Handle type="target" :position="Position.Top" id="top-t" class="arch-handle target-handle" />
    <!-- Bottom Handles -->
    <Handle type="source" :position="Position.Bottom" id="bottom-s" class="arch-handle" />
    <Handle type="target" :position="Position.Bottom" id="bottom-t" class="arch-handle target-handle" />
    <!-- Right Handles -->
    <Handle type="source" :position="Position.Right" id="right-s" class="arch-handle arch-handle-right" />
    <Handle type="target" :position="Position.Right" id="right-t" class="arch-handle arch-handle-right target-handle" />
    <!-- Left Handles -->
    <Handle type="source" :position="Position.Left" id="left-s" class="arch-handle arch-handle-left" />
    <Handle type="target" :position="Position.Left" id="left-t" class="arch-handle arch-handle-left target-handle" />
</div>
</template>

<style scoped>
.arch-node {
  min-width: 160px;
  max-width: 200px;
  background: #141420;
  border: 1px solid rgba(255,255,255,0.07);
  border-top: 2px solid var(--db-accent);
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.2);
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
  color: var(--db-accent);
  background: color-mix(in srgb, var(--db-accent) 12%, transparent);
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

.db-type-badge {
  display: inline-block;
  margin-top: 8px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--db-accent);
  background: color-mix(in srgb, var(--db-accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--db-accent) 25%, transparent);
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
