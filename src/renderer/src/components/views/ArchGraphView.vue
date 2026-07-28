<script setup lang="ts">
import { onMounted } from 'vue'
import ArchCanvas    from '../architecture/ArchCanvas.vue'
import NodePalette   from '../architecture/NodePalette.vue'
import { useArchGraph } from '../architecture/composables/useArchGraph'

const archGraph = useArchGraph()

onMounted(() => {
  archGraph.loadGraph({
    nodes: [
      { id: 'gateway', type: 'service',  position: { x: 250, y: 50  }, data: { label: 'API Gateway',        kind: 'service',  status: 'healthy',  tech: 'Express/Node' } },
      { id: 'auth',    type: 'service',  position: { x: 100, y: 200 }, data: { label: 'Auth Service',       kind: 'service',  status: 'healthy',  tech: 'Go' } },
      { id: 'db-auth', type: 'database', position: { x: 100, y: 350 }, data: { label: 'Users DB',           kind: 'database', dbType: 'relational', tech: 'PostgreSQL' } },
      { id: 'worker',  type: 'service',  position: { x: 400, y: 200 }, data: { label: 'Background Worker',  kind: 'service',  status: 'degraded', tech: 'Python' } },
      { id: 'queue',   type: 'queue',    position: { x: 400, y: 350 }, data: { label: 'Task Queue',         kind: 'queue',    pattern: 'pub-sub', tech: 'Redis' } },
    ],
    edges: [
      { id: 'e1', source: 'gateway', target: 'auth',    data: { label: 'gRPC' } },
      { id: 'e2', source: 'auth',    target: 'db-auth', data: { label: 'TCP' } },
      { id: 'e3', source: 'gateway', target: 'worker',  data: { label: 'async', animated: true } },
      { id: 'e4', source: 'worker',  target: 'queue',   data: { label: 'publish' } },
    ],
  })
})
</script>

<template>
  <div class="arch-view">
    <NodePalette />
    <div class="arch-canvas-area">
      <ArchCanvas />
    </div>
  </div>
</template>

<style scoped>
.arch-view {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  background: var(--bg-panel);
  overflow: hidden;
}

.arch-canvas-area {
  flex: 1;
  height: 100%;
  position: relative;
  overflow: hidden;
}
</style>
