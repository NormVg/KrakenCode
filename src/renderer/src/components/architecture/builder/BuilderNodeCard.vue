<script setup lang="ts">
import { computed } from 'vue'
import type { ArchNode } from './types'
import { KIND_COLORS } from './types'

const props = defineProps<{
  node: ArchNode
  selected: boolean
  connectFrom: boolean
}>()

const emit = defineEmits<{
  (e: 'select', id: string, additive: boolean): void
  (e: 'pointerdown', id: string, event: PointerEvent): void
  (e: 'dblclick', id: string): void
}>()

const accent = computed(() => KIND_COLORS[props.node.kind])
const kindLabel = computed(() => props.node.kind)
</script>

<template>
  <div
    class="builder-node"
    :class="{ selected, 'connect-from': connectFrom }"
    :style="{
      left: `${node.x}px`,
      top: `${node.y}px`,
      '--accent': accent,
    }"
    @pointerdown.stop="emit('pointerdown', node.id, $event)"
    @click.stop="emit('select', node.id, $event.shiftKey)"
    @dblclick.stop="emit('dblclick', node.id)"
  >
    <div class="node-kind">{{ kindLabel }}</div>
    <div class="node-label">{{ node.label }}</div>
    <div v-if="node.tech" class="node-tech">{{ node.tech }}</div>
  </div>
</template>

<style scoped>
.builder-node {
  position: absolute;
  width: 168px;
  min-height: 64px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #0A0D18;
  border: 1.5px solid color-mix(in srgb, var(--accent) 55%, rgba(255, 255, 255, 0.12));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35), 0 6px 18px rgba(0, 0, 0, 0.2);
  cursor: grab;
  user-select: none;
  touch-action: none;
  transition: border-color 140ms ease-out, box-shadow 140ms ease-out;
  z-index: 2;
}

.builder-node:active {
  cursor: grabbing;
}

.builder-node.selected {
  border-color: var(--accent);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent),
    0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 3;
}

.builder-node.connect-from {
  border-color: #E2E8F0;
  box-shadow: 0 0 0 2px rgba(226, 232, 240, 0.25);
}

.node-kind {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 4px;
}

.node-label {
  font-size: 13px;
  font-weight: 600;
  color: #E2E8F0;
  line-height: 1.3;
  word-break: break-word;
}

.node-tech {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  font-family: var(--font-code);
}
</style>
