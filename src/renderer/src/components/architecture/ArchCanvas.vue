<script setup lang="ts">
import { ref } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import { Controls } from '@vue-flow/controls'

// Import core styles
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

// Import custom nodes
import ServiceNode from './nodes/ServiceNode.vue'
import DatabaseNode from './nodes/DatabaseNode.vue'
import QueueNode from './nodes/QueueNode.vue'
import GroupNode from './nodes/GroupNode.vue'
import ExternalNode from './nodes/ExternalNode.vue'

const nodeTypes = {
  service: ServiceNode,
  database: DatabaseNode,
  queue: QueueNode,
  group: GroupNode,
  external: ExternalNode,
}
</script>

<template>
  <div class="arch-canvas-container">
    <VueFlow
      id="arch-canvas"
      :node-types="nodeTypes"
      :default-viewport="{ zoom: 1 }"
      :min-zoom="0.1"
      :max-zoom="4"
      fit-view-on-init
      class="kraken-arch-flow"
    >
      <Background pattern-color="rgba(255, 255, 255, 0.05)" :gap="24" :size="1" />
      
      <Controls position="top-left" class="arch-controls" />
      
      <MiniMap position="top-right" class="arch-minimap" :node-color="(node) => {
        if (node.type === 'database') return '#3B82F6'
        if (node.type === 'service') return '#9374BE'
        if (node.type === 'queue') return '#0EA5E9'
        if (node.type === 'group') return 'rgba(255,255,255,0.1)'
        return '#444'
      }" />
    </VueFlow>
  </div>
</template>

<style scoped>
.arch-canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: var(--bg-dark); /* Match app background */
}

/* Base Flow Overrides */
.kraken-arch-flow {
  background-color: transparent;
}

/* Custom Controls Style */
:deep(.arch-controls) {
  background: rgba(20, 20, 32, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  fill: rgba(255, 255, 255, 0.7);
}

:deep(.arch-controls button) {
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}
:deep(.arch-controls button:hover) {
  background: rgba(255, 255, 255, 0.1);
}
:deep(.arch-controls button:last-child) {
  border-bottom: none;
}

/* Custom Minimap Style */
:deep(.arch-minimap) {
  background: rgba(20, 20, 32, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  /* Reduce size */
  width: 120px !important;
  height: 80px !important;
}

:deep(.arch-minimap .vue-flow__minimap-mask) {
  fill: rgba(0, 0, 0, 0.6);
}
</style>
