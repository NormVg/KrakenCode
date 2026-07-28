<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { GroupNodeData } from '../types/arch.types'

const props = defineProps<{
  data: GroupNodeData
  selected?: boolean
}>()
</script>

<template>
  <div class="arch-node group-node" :class="{ selected }" :style="{ '--group-color': data.color ?? 'rgba(255,255,255,0.05)' }">
    <div class="group-label">{{ data.label }}</div>
    <div v-if="data.description" class="group-desc">{{ data.description }}</div>
    
    <!-- Group nodes do not typically have handles; children connect to each other, or connections go to the group border. Vue Flow handles group borders automatically if needed. -->
  
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
  background: var(--group-color);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  min-width: 280px;
  min-height: 200px;
  width: 100%;
  height: 100%;
  padding: 16px;
  position: relative;
  z-index: -1;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.arch-node.selected {
  border-color: rgba(170, 32, 90, 0.6);
  background: color-mix(in srgb, var(--group-color) 80%, rgba(170, 32, 90, 0.1));
}

.group-label {
  position: absolute;
  top: -12px;
  left: 16px;
  background: #1A1A24; /* Should match the canvas background to mask the border */
  padding: 0 8px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255,255,255,0.6);
}

.group-desc {
  position: absolute;
  bottom: 8px;
  left: 16px;
  font-size: 0.65rem;
  color: rgba(255,255,255,0.3);
}
</style>
