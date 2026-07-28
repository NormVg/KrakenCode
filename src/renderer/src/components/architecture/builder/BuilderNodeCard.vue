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

const labelEl = ref<HTMLElement | null>(null)
const techEl = ref<HTMLElement | null>(null)
const accent = computed(() => KIND_COLORS[props.node.kind])
const isText = computed(() => props.node.kind === 'text')
const kindLabel = computed(() => props.node.kind)

let labelBefore = ''
let techBefore = ''

watch(
  () => props.editing,
  async (on) => {
    await nextTick()
    if (on) {
      labelBefore = props.node.label
      techBefore = props.node.tech ?? ''
      if (labelEl.value) {
        labelEl.value.textContent = props.node.label || ''
        labelEl.value.focus()
        selectAll(labelEl.value)
      }
      if (techEl.value) {
        techEl.value.textContent = props.node.tech ?? ''
      }
    }
  },
)

watch(
  () => [props.node.label, props.node.tech, props.editing] as const,
  ([label, tech, editing]) => {
    if (editing) return
    if (labelEl.value && labelEl.value.textContent !== label) {
      labelEl.value.textContent = label
    }
    if (techEl.value) {
      const t = tech ?? ''
      if (techEl.value.textContent !== t) techEl.value.textContent = t
    }
  },
)

function selectAll(el: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

function readLabel(): string {
  return (labelEl.value?.innerText ?? '').replace(/\u00a0/g, ' ').trim()
}

function readTech(): string | undefined {
  if (isText.value) return undefined
  const t = (techEl.value?.innerText ?? '').replace(/\u00a0/g, ' ').trim()
  return t || undefined
}

function commit() {
  const label = readLabel() || KIND_DEFAULT_LABEL[props.node.kind]
  emit('commit-edit', props.node.id, label, readTech())
}

function cancel() {
  if (labelEl.value) labelEl.value.textContent = labelBefore
  if (techEl.value) techEl.value.textContent = techBefore
  emit('cancel-edit')
}

function onKeydown(e: KeyboardEvent) {
  e.stopPropagation()
  if (e.key === 'Escape') {
    e.preventDefault()
    cancel()
    return
  }
  if (e.key === 'Enter' && !isText.value) {
    e.preventDefault()
    commit()
  }
  if (e.key === 'Enter' && isText.value && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    commit()
  }
}

function onBlur(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  const root = (e.currentTarget as HTMLElement).closest('.builder-node')
  if (next && root?.contains(next)) return
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

function onDblClick(e: MouseEvent) {
  e.stopPropagation()
  emit('start-edit', props.node.id)
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
    @dblclick="onDblClick"
  >
    <div v-if="!isText" class="node-kind">{{ kindLabel }}</div>

    <!-- Same elements always — contenteditable when editing (no input chrome) -->
    <div
      ref="labelEl"
      class="node-label"
      :class="{ placeholder: !node.label && !editing }"
      :contenteditable="editing"
      :spellcheck="false"
      role="textbox"
      :aria-label="isText ? 'Text' : 'Label'"
      @keydown="onKeydown"
      @blur="onBlur"
      @pointerdown.stop="editing && $event.stopPropagation()"
    >{{ node.label || (editing ? '' : KIND_DEFAULT_LABEL[node.kind]) }}</div>

    <div
      v-if="!isText && (editing || node.tech)"
      ref="techEl"
      class="node-tech"
      :class="{ placeholder: editing && !node.tech, editable: editing }"
      :contenteditable="editing"
      :spellcheck="false"
      :data-placeholder="'tech'"
      role="textbox"
      aria-label="Tech"
      @keydown="onKeydown"
      @blur="onBlur"
      @pointerdown.stop="editing && $event.stopPropagation()"
    >{{ node.tech ?? '' }}</div>
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
  transition: border-color 160ms ease-out, box-shadow 160ms ease-out;
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
  user-select: text;
  border-color: var(--accent);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--accent) 28%, transparent),
    0 8px 24px rgba(0, 0, 0, 0.4);
}

.builder-node.selected:not(.editing) {
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
  pointer-events: none;
}

.node-label {
  font-size: 13px;
  font-weight: 600;
  color: #E2E8F0;
  line-height: 1.35;
  word-break: break-word;
  white-space: pre-wrap;
  outline: none;
  min-height: 1.2em;
  caret-color: #E2E8F0;
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

.node-label[contenteditable='true'] {
  cursor: text;
}

.node-tech {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  font-family: var(--font-code);
  line-height: 1.3;
  outline: none;
  min-height: 1.1em;
  caret-color: rgba(255, 255, 255, 0.55);
  white-space: pre-wrap;
  word-break: break-word;
}

.node-tech.editable {
  cursor: text;
}

.node-tech.placeholder:empty::before {
  content: attr(data-placeholder);
  color: rgba(255, 255, 255, 0.22);
  font-style: normal;
}
</style>
