<script setup lang="ts">
// ─── NodePalette ─────────────────────────────────────────────────────────────
// Left-side palette of draggable node type cards.
// User drags a card onto the canvas to create that node type.
// ─────────────────────────────────────────────────────────────────────────────

interface PaletteItem {
  type: string
  label: string
  icon: string
  description: string
  color: string
}

const items: PaletteItem[] = [
  { type: 'service',  label: 'Service',  icon: '⬡', description: 'API, microservice, worker', color: '#9374BE' },
  { type: 'database', label: 'Database', icon: '⬟', description: 'SQL, NoSQL, vector store',  color: '#3B82F6' },
  { type: 'queue',    label: 'Queue',    icon: '◈', description: 'Message queue, pub-sub',    color: '#0EA5E9' },
  { type: 'external', label: 'External', icon: '◎', description: '3rd party API, CDN, SaaS',  color: '#F59E0B' },
  { type: 'client',   label: 'Client',   icon: '◉', description: 'Web, mobile, desktop app',  color: '#10B981' },
  { type: 'group',    label: 'Group',    icon: '⬜', description: 'Zone, namespace, cluster',  color: '#6B7280' },
]

function onDragStart(event: DragEvent, type: string) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('application/kraken-arch-node-type', type)
  event.dataTransfer.effectAllowed = 'copy'
}
</script>

<template>
  <div class="node-palette">
    <div class="palette-header">
      <span class="palette-title">Elements</span>
    </div>

    <div class="palette-section">
      <div class="section-label">Drag to canvas</div>
      <div class="palette-items">
        <div
          v-for="item in items"
          :key="item.type"
          class="palette-item"
          draggable="true"
          :style="{ '--node-color': item.color }"
          @dragstart="onDragStart($event, item.type)"
        >
          <div class="item-icon" :style="{ color: item.color }">{{ item.icon }}</div>
          <div class="item-info">
            <span class="item-label">{{ item.label }}</span>
            <span class="item-desc">{{ item.description }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="palette-section palette-tips">
      <div class="section-label">Shortcuts</div>
      <div class="tip-row"><kbd>Del</kbd><span>Delete selected</span></div>
      <div class="tip-row"><kbd>Ctrl+A</kbd><span>Select all</span></div>
      <div class="tip-row"><kbd>Scroll</kbd><span>Zoom in/out</span></div>
      <div class="tip-row"><kbd>Drag</kbd><span>Pan canvas</span></div>
      <div class="tip-row"><kbd>DblClick</kbd><span>Edit label</span></div>
    </div>
  </div>
</template>

<style scoped>
.node-palette {
  width: 180px;
  min-width: 180px;
  height: 100%;
  background: var(--bg-sidebar, #1a1a2e);
  border-right: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  user-select: none;
}

.palette-header {
  padding: 14px 12px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.palette-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
}

.palette-section {
  padding: 10px 10px;
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.25);
  margin-bottom: 8px;
}

.palette-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.03);
  cursor: grab;
  transition: all 0.15s ease;
}

.palette-item:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: var(--node-color);
  box-shadow: 0 0 0 1px var(--node-color), 0 4px 12px rgba(0,0,0,0.3);
  transform: translateX(2px);
}

.palette-item:active {
  cursor: grabbing;
  transform: scale(0.97);
}

.item-icon {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
  filter: drop-shadow(0 0 4px currentColor);
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.item-label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1;
}

.item-desc {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Tips section */
.palette-tips {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.tip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.tip-row kbd {
  font-size: 9px;
  padding: 2px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.5);
  font-family: inherit;
  white-space: nowrap;
  flex-shrink: 0;
}

.tip-row span {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
}
</style>
