<script setup lang="ts">
import { onMounted } from 'vue'
import ArchCanvas from '../architecture/ArchCanvas.vue'
import ArchToolbar from '../architecture/ArchToolbar.vue'
import { useArchGraph } from '../architecture/composables/useArchGraph'

const archGraph = useArchGraph()

// Load a dummy graph on mount just to test the UI for now.
// Later, this will load from the workspace's architecture.json file.
onMounted(() => {
  archGraph.loadGraph({
    meta: { title: 'Kraken Demo Architecture' },
    nodes: [
      {
        id: 'gateway',
        type: 'service',
        position: { x: 250, y: 50 },
        data: { label: 'API Gateway', kind: 'service', status: 'healthy', tech: 'Express/Node' }
      },
      {
        id: 'auth',
        type: 'service',
        position: { x: 100, y: 200 },
        data: { label: 'Auth Service', kind: 'service', status: 'healthy', tech: 'Go' }
      },
      {
        id: 'db-auth',
        type: 'database',
        position: { x: 100, y: 350 },
        data: { label: 'Users DB', kind: 'database', dbType: 'relational', tech: 'PostgreSQL' }
      },
      {
        id: 'worker',
        type: 'service',
        position: { x: 400, y: 200 },
        data: { label: 'Background Worker', kind: 'service', status: 'degraded', tech: 'Python' }
      },
      {
        id: 'queue',
        type: 'queue',
        position: { x: 400, y: 350 },
        data: { label: 'Task Queue', kind: 'queue', pattern: 'pub-sub', tech: 'Redis' }
      }
    ],
    edges: [
      { id: 'e1', source: 'gateway', target: 'auth', data: { label: 'gRPC' } },
      { id: 'e2', source: 'auth', target: 'db-auth', data: { label: 'TCP' } },
      { id: 'e3', source: 'gateway', target: 'worker', data: { label: 'async', animated: true } },
      { id: 'e4', source: 'worker', target: 'queue', data: { label: 'publish' } }
    ]
  })
})
</script>

<template>
  <div class="architecture-view-wrapper">
    <ArchToolbar />
    <div class="canvas-wrapper">
      <ArchCanvas />
    </div>
  </div>
</template>

<style scoped>
.architecture-view-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--bg-dark);
}

.canvas-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
</style>
