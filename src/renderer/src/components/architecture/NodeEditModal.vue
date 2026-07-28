<script setup lang="ts">
// ─── NodeEditModal ────────────────────────────────────────────────────────────
// Floating inline editor that appears when user double-clicks a node.
// Allows editing label and tech stack.
// ─────────────────────────────────────────────────────────────────────────────
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  nodeId: string | null
  initialLabel: string
  initialTech: string
  x: number
  y: number
}>()

const emit = defineEmits<{
  (e: 'confirm', id: string, label: string, tech: string): void
  (e: 'cancel'): void
}>()

const label = ref('')
const tech = ref('')
const labelInput = ref<HTMLInputElement | null>(null)

watch(() => props.nodeId, async (id) => {
  if (id) {
    label.value = props.initialLabel
    tech.value = props.initialTech
    await nextTick()
    labelInput.value?.select()
  }
}, { immediate: true })

function confirm() {
  if (!props.nodeId) return
  emit('confirm', props.nodeId, label.value.trim() || 'Unnamed', tech.value.trim())
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') confirm()
  if (e.key === 'Escape') emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="nodeId"
      class="node-edit-overlay"
      @click.self="emit('cancel')"
    >
      <div
        class="node-edit-modal"
        :style="{ left: `${x}px`, top: `${y}px` }"
        @keydown="onKeydown"
      >
        <div class="edit-field">
          <label class="edit-label">Label</label>
          <input
            ref="labelInput"
            v-model="label"
            class="edit-input"
            placeholder="Node name..."
          />
        </div>
        <div class="edit-field">
          <label class="edit-label">Tech</label>
          <input
            v-model="tech"
            class="edit-input"
            placeholder="e.g. PostgreSQL, Redis..."
          />
        </div>
        <div class="edit-actions">
          <button class="btn-cancel" @click="emit('cancel')">Cancel</button>
          <button class="btn-confirm" @click="confirm">Apply</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.node-edit-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.node-edit-modal {
  position: absolute;
  background: rgba(18, 18, 30, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 14px;
  width: 220px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.05);
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  transform: translate(-50%, -110%);
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.edit-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.3);
}

.edit-input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 6px 10px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.edit-input:focus {
  border-color: var(--accent, #FF5F5F);
  background: rgba(255, 255, 255, 0.08);
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
}

.btn-cancel, .btn-confirm {
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.5);
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
}

.btn-confirm {
  background: var(--accent, #FF5F5F);
  color: #fff;
}

.btn-confirm:hover {
  opacity: 0.85;
}
</style>
