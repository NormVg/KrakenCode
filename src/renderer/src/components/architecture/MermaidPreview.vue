<script setup lang="ts">
import { ref, watch, onMounted, nextTick, shallowRef, computed } from 'vue'
import mermaid from 'mermaid'

const props = defineProps<{
  source: string
  /** When true, primary pointer drag pans the canvas */
  panEnabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'error', message: string | null): void
  (e: 'rendered'): void
  (e: 'viewport', payload: { zoom: number; pan: { x: number; y: number } }): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const svgHtml = shallowRef('')
const renderError = ref<string | null>(null)
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const isPanning = ref(false)

let panStart = { x: 0, y: 0, panX: 0, panY: 0 }
let renderSeq = 0
let mermaidReady = false

const zoomPercent = computed(() => Math.round(zoom.value * 100))

function emitViewport() {
  emit('viewport', { zoom: zoom.value, pan: { ...pan.value } })
}

function ensureMermaid() {
  if (mermaidReady) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'dark',
    darkMode: true,
    fontFamily: 'Inter, system-ui, sans-serif',
    flowchart: {
      curve: 'basis',
      padding: 16,
      htmlLabels: true,
      nodeSpacing: 40,
      rankSpacing: 50,
    },
    sequence: {
      actorMargin: 48,
      messageMargin: 36,
    },
    themeVariables: {
      darkMode: true,
      background: '#0A0D18',
      primaryColor: '#1C1C2A',
      primaryTextColor: '#E2E8F0',
      primaryBorderColor: 'rgba(157, 161, 211, 0.4)',
      secondaryColor: '#1C1C2A',
      tertiaryColor: '#0A0D18',
      lineColor: '#9DA1D3',
      textColor: '#E2E8F0',
      mainBkg: '#1C1C2A',
      nodeBorder: 'rgba(157, 161, 211, 0.4)',
      clusterBkg: 'rgba(28, 28, 42, 0.9)',
      clusterBorder: 'rgba(255, 255, 255, 0.08)',
      titleColor: '#9DA1D3',
      edgeLabelBackground: '#0A0D18',
      actorBkg: '#1C1C2A',
      actorBorder: 'rgba(157, 161, 211, 0.4)',
      actorTextColor: '#E2E8F0',
      signalColor: '#9DA1D3',
      signalTextColor: '#E2E8F0',
      labelBoxBkgColor: '#1C1C2A',
      labelBoxBorderColor: 'rgba(255, 255, 255, 0.08)',
      labelTextColor: '#E2E8F0',
      loopTextColor: '#E2E8F0',
      noteBkgColor: '#1C1C2A',
      noteTextColor: '#E2E8F0',
      noteBorderColor: 'rgba(255, 255, 255, 0.08)',
      activationBkgColor: 'rgba(147, 116, 190, 0.15)',
      activationBorderColor: '#9374BE',
      sequenceNumberColor: '#0A0D18',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
  })
  mermaidReady = true
}

async function renderDiagram(raw: string) {
  ensureMermaid()
  const code = raw.trim()
  if (!code) {
    svgHtml.value = ''
    renderError.value = null
    emit('error', null)
    return
  }

  const seq = ++renderSeq
  try {
    await mermaid.parse(code)
    if (seq !== renderSeq) return

    const id = `kraken-arch-${Date.now()}-${seq}`
    const { svg } = await mermaid.render(id, code)
    if (seq !== renderSeq) return

    svgHtml.value = svg
    renderError.value = null
    emit('error', null)
    emit('rendered')
    await nextTick()
    styleInjectedSvg()
  } catch (err) {
    if (seq !== renderSeq) return
    const message = err instanceof Error ? err.message : String(err)
    const clean = message
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(' · ')
    renderError.value = clean
    emit('error', clean)
  }
}

function styleInjectedSvg() {
  const root = containerRef.value
  if (!root) return
  const svg = root.querySelector('svg')
  if (!svg) return
  svg.removeAttribute('height')
  svg.style.maxWidth = '100%'
  svg.style.height = 'auto'
  svg.style.display = 'block'
}

function fitView() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
  emitViewport()
}

function zoomBy(delta: number) {
  zoom.value = Math.min(3, Math.max(0.25, Number((zoom.value + delta).toFixed(2))))
  emitViewport()
}

function setZoom(next: number) {
  zoom.value = Math.min(3, Math.max(0.25, Number(next.toFixed(2))))
  emitViewport()
}

function onWheel(e: WheelEvent) {
  // Pinch / ctrl-scroll → zoom
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    zoomBy(e.deltaY > 0 ? -0.08 : 0.08)
    return
  }
  // Trackpad scroll → pan
  e.preventDefault()
  pan.value = {
    x: pan.value.x - e.deltaX,
    y: pan.value.y - e.deltaY,
  }
  emitViewport()
}

function shouldStartPan(e: PointerEvent): boolean {
  if (e.button === 1) return true // middle mouse
  if (e.altKey) return true
  if (props.panEnabled !== false && e.button === 0) return true // default: drag to pan
  return false
}

function onPointerDown(e: PointerEvent) {
  if (!shouldStartPan(e)) return
  e.preventDefault()
  isPanning.value = true
  panStart = { x: e.clientX, y: e.clientY, panX: pan.value.x, panY: pan.value.y }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!isPanning.value) return
  pan.value = {
    x: panStart.panX + (e.clientX - panStart.x),
    y: panStart.panY + (e.clientY - panStart.y),
  }
}

function onPointerUp(e: PointerEvent) {
  if (!isPanning.value) return
  isPanning.value = false
  emitViewport()
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    /* already released */
  }
}

function onDoubleClick() {
  fitView()
}

watch(
  () => props.source,
  (next) => {
    void renderDiagram(next)
  },
  { immediate: true },
)

onMounted(() => {
  ensureMermaid()
})

defineExpose({
  fitView,
  zoomBy,
  setZoom,
  zoom,
  zoomPercent,
  pan,
})
</script>

<template>
  <div
    class="mermaid-preview"
    :class="{ panning: isPanning }"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dblclick="onDoubleClick"
  >
    <div
      class="preview-transform"
      :style="{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      }"
    >
      <div
        v-if="svgHtml && !renderError"
        ref="containerRef"
        class="svg-host"
        v-html="svgHtml"
      />
    </div>

    <div v-if="renderError" class="preview-error" role="alert">
      {{ renderError }}
    </div>

    <div v-else-if="!source.trim()" class="preview-empty">
      Write Mermaid in Code mode
    </div>
  </div>
</template>

<style scoped>
.mermaid-preview {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  background: #0A0D18;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}

.mermaid-preview.panning {
  cursor: grabbing;
}

.preview-transform {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 56px 24px calc(24px + var(--bottom-bar-clearance));
  transform-origin: center center;
  transition: transform 120ms ease-out;
  will-change: transform;
}

.mermaid-preview.panning .preview-transform {
  transition: none;
}

.svg-host {
  max-width: min(920px, 100%);
  pointer-events: none; /* pan hits the stage, not SVG internals */
}

.svg-host :deep(svg) {
  max-width: 100%;
  height: auto;
}

.preview-error {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(400px, calc(100% - 48px));
  padding: 12px 14px;
  border-radius: var(--chrome-radius);
  background: rgba(255, 95, 95, 0.08);
  border: 1px solid rgba(255, 95, 95, 0.25);
  color: var(--text-muted);
  font-size: 12px;
  font-family: var(--font-code);
  line-height: 1.5;
  word-break: break-word;
}

.preview-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted-dark);
  font-size: 13px;
  padding: 24px;
  padding-bottom: calc(24px + var(--bottom-bar-clearance));
}
</style>
