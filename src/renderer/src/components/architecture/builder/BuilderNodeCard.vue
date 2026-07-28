<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { ArchNode } from './types'
import { KIND_COLORS, KIND_DEFAULT_LABEL } from './types'

const props = defineProps<{
  node: ArchNode
  selected: boolean
  connectFrom: boolean
  editing: boolean
}>()

const emit = defineEmits<{
  (e: 'select', id: string, additive: boolean): void
  (e: 'pointerdown', id: string, event: PointerEvent): void
  (e: 'start-edit', id: string): void
  (e: 'commit-edit', id: string, label: string, tech?: string): void
  (e: 'cancel-edit'): void
}>()

const labelDraft = ref(props.node.label)
const techDraft = ref(props.node.tech ?? '')
const labelInput = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)

const accent = computed(() => KIND_COLORS[props.node.kind])
const isText = computed(() => props.node.kind === 'text')
const kindLabel = computed(() => props.node.kind)

watch(
  () => props.editing,
  async (on) => {
    if (on) {
      labelDraft.value = props.node.label
      techDraft.value = props.node.tech ?? ''
      await nextTick()
      labelInput.value?.focus()
      labelInput.value?.select()
    }
  },
)

watch(
  () => props.node.label,
  (v) => {
    if (!props.editing) labelDraft.value = v
  },
)

function commit() {
  const label =
    labelDraft.value.trim() || KIND_DEFAULT_LABEL[props.node.kind]
  const tech = techDraft.value.trim() || undefined
  emit('commit-edit', props.node.id, label, tech)
}

function onLabelKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    emit('cancel-edit')
    return
  }
  // Single-line: Enter commits. Text: ⌘/Ctrl+Enter commits (Enter = newline).
  if (e.key === 'Enter' && !isText.value) {
    e.preventDefault()
    commit()
  }
  if (e.key === 'Enter' && isText.value && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    commit()
  }
  e.stopPropagation()
}

/** Don't exit edit when tabbing between label/tech inside the same card */
function onFieldBlur(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  const root = (e.currentTarget as HTMLElement).closest('.builder-node')
  if (next && root?.contains(next)) return
  // Defer so a click on the other field can take focus first
  requestAnimationFrame(() => {
    if (!props.editing) return
    const active = document.activeElement
    if (active && root?.contains(active)) return
    commit()
  })
}

function onPointerDown(e: PointerEvent) {
  if (props.editing) {
    e.stopPropagation()
    return
  }
  emit('pointerdown', props.node.id, e)
}
</script>

<template>
  <div
    class="builder-node"
    :class="{
      selected,
      'connect-from': connectFrom,
      editing,
      'is-text': isText,
    }"
    :style="{
      left: `${node.x}px`,
      top: `${node.y}px`,
      '--accent': accent,
    }"
    @pointerdown.stop="onPointerDown"
    @click.stop="emit('select', node.id, $event.shiftKey)"
    @dblclick.stop="emit('start-edit', node.id)"
  >
    <template v-if="!isText">
      <div class="node-kind">{{ kindLabel }}</div>
    </template>

    <!-- Inline edit -->
    <template v-if="editing">
      <textarea
        v-if="isText"
        ref="labelInput"
        v-model="labelDraft"
        class="inline-input inline-textarea"
        rows="3"
        @keydown="onLabelKeydown"
        @blur="onFieldBlur"
        @pointerdown.stop
        @click.stop
      />
      <template v-else>
        <input
          ref="labelInput"
          v-model="labelDraft"
          class="inline-input"
          @keydown="onLabelKeydown"
          @blur="onFieldBlur"
          @pointerdown.stop
          @click.stop
        />
        <input
          v-model="techDraft"
          class="inline-input tech"
          placeholder="tech (optional)"
          @keydown="onLabelKeydown"
          @blur="onFieldBlur"
          @pointerdown.stop
          @click.stop
        />
      </template>
    </template>

    <!-- Display -->
    <template v-else>
      <div class="node-label" :class="{ placeholder: !node.label }">
        {{ node.label || KIND_DEFAULT_LABEL[node.kind] }}
      </div>
      <div v-if="node.tech && !isText" class="node-tech">{{ node.tech }}</div>
    </template>
  </div>
</template>

<style scoped>
.builder-node {
  position: absolute;
  width: 176px;
  min-height: 70px;
  box-sizing: border-box;
  padding: 12px 14px;
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

.builder-node.is-text {
  width: 200px;
  min-height: 56px;
  background: rgba(10, 13, 24, 0.72);
  border-style: dashed;
  border-color: rgba(157, 161, 211, 0.35);
}

.builder-node:active:not(.editing) {
  cursor: grabbing;
}

.builder-node.editing {
  cursor: text;
  z-index: 5;
  border-color: var(--accent);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent),
    0 8px 24px rgba(0, 0, 0, 0.45);
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
  line-height: 1.35;
  word-break: break-word;
  white-space: pre-wrap;
}

.builder-node.is-text .node-label {
  font-weight: 500;
  color: rgba(226, 232, 240, 0.85);
  font-size: 12.5px;
}

.node-label.placeholder {
  color: rgba(255, 255, 255, 0.3);
  font-weight: 500;
}

.node-tech {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  font-family: var(--font-code);
}

.inline-input {
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #1C1C2A;
  color: #E2E8F0;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  outline: none;
  line-height: 1.35;
}

.inline-input:focus {
  border-color: color-mix(in srgb, var(--accent) 60%, transparent);
}

.inline-input.tech {
  margin-top: 6px;
  font-size: 11px;
  font-weight: 500;
  font-family: var(--font-code);
  color: rgba(226, 232, 240, 0.7);
}

.inline-textarea {
  resize: vertical;
  min-height: 64px;
  font-weight: 500;
  line-height: 1.4;
}
</style>
