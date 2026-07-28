<script setup lang="ts">
import { ref, watch, onMounted, nextTick, shallowRef } from 'vue'
import mermaid from 'mermaid'

const props = defineProps<{
  source: string
}>()

const emit = defineEmits<{
  (e: 'error', message: string | null): void
  (e: 'rendered'): void
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
      background: '#141420',
      primaryColor: '#1C1C2A',
      primaryTextColor: '#E2E8F0',
      primaryBorderColor: '#9374BE',
      secondaryColor: '#181825',
      tertiaryColor: '#0A0D18',
      lineColor: '#9DA1D3',
      textColor: '#E2E8F0',
      mainBkg: '#1C1C2A',
      nodeBorder: '#9374BE',
      clusterBkg: 'rgba(28, 28, 42, 0.7)',
      clusterBorder: 'rgba(147, 116, 190, 0.35)',
      titleColor: '#E2E8F0',
      edgeLabelBackground: '#141420',
      actorBkg: '#1C1C2A',
      actorBorder: '#9374BE',
      actorTextColor: '#E2E8F0',
      signalColor: '#9DA1D3',
      signalTextColor: '#E2E8F0',
      labelBoxBkgColor: '#1C1C2A',
      labelBoxBorderColor: 'rgba(255,255,255,0.12)',
      labelTextColor: '#E2E8F0',
      loopTextColor: '#E2E8F0',
      noteBkgColor: '#181825',
      noteTextColor: '#E2E8F0',
      noteBorderColor: 'rgba(255,255,255,0.12)',
      activationBkgColor: 'rgba(147, 116, 190, 0.2)',
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
    // Validate first so we don't leave broken SVG in the DOM
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
    // Mermaid errors are often multi-line; keep the first useful line
    const clean = message
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 3)
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
}

function zoomBy(delta: number) {
  zoom.value = Math.min(3, Math.max(0.35, Number((zoom.value + delta).toFixed(2))))
}

function onWheel(e: WheelEvent) {
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault()
    zoomBy(e.deltaY > 0 ? -0.08 : 0.08)
  }
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.button !== 1) return
  // Middle mouse or space-pan would be ideal; allow drag on empty stage with alt or middle
  if (e.button === 1 || e.altKey) {
    e.preventDefault()
    isPanning.value = true
    panStart = { x: e.clientX, y: e.clientY, panX: pan.value.x, panY: pan.value.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
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
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    /* already released */
  }
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

defineExpose({ fitView, zoomBy, zoom, pan })
</script>

<template>
  <div class="mermaid-preview">
    <div
      class="preview-stage"
      :class="{ panning: isPanning }"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
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
        <div class="error-title">Diagram error</div>
        <div class="error-body">{{ renderError }}</div>
        <div class="error-hint">Fix the Mermaid syntax on the left — preview updates as you type.</div>
      </div>

      <div v-else-if="!source.trim()" class="preview-empty">
        <p>Write Mermaid on the left to render architecture here.</p>
      </div>
    </div>

    <div class="preview-chrome">
      <button type="button" class="chrome-btn" title="Zoom out" @click="zoomBy(-0.1)">−</button>
      <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
      <button type="button" class="chrome-btn" title="Zoom in" @click="zoomBy(0.1)">+</button>
      <div class="chrome-divider" />
      <button type="button" class="chrome-btn text" title="Reset view" @click="fitView">Fit</button>
      <span class="chrome-hint">⌘/Ctrl+scroll zoom · Alt+drag pan</span>
    </div>
  </div>
</template>

<style scoped>
.mermaid-preview {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background:
    radial-gradient(ellipse 70% 50% at 50% 0%, rgba(147, 116, 190, 0.06) 0%, transparent 55%),
    #141420;
  overflow: hidden;
}

.preview-stage {
  flex: 1;
  position: relative;
  overflow: hidden;
  cursor: default;
  min-height: 0;
}

.preview-stage.panning {
  cursor: grabbing;
}

.preview-transform {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  transform-origin: center center;
  transition: transform 120ms ease-out;
  will-change: transform;
}

.preview-stage.panning .preview-transform {
  transition: none;
}

.svg-host {
  max-width: min(960px, 100%);
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.45));
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
  width: min(420px, calc(100% - 48px));
  padding: 16px;
  border-radius: 12px;
  background: rgba(226, 75, 74, 0.1);
  border: 1px solid hsla(0, 65%, 60%, 0.35);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5), 0 8px 32px rgba(0, 0, 0, 0.35);
}

.error-title {
  font-size: 13px;
  font-weight: 600;
  color: hsl(0, 65%, 76%);
  margin: 0 0 8px;
}

.error-body {
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.7);
  font-family: var(--font-code);
  word-break: break-word;
}

.error-hint {
  margin-top: 12px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}

.preview-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.35);
  font-size: 13px;
  padding: 24px;
  text-align: center;
}

.preview-empty p {
  margin: 0;
}

.preview-chrome {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 13, 24, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.chrome-btn {
  min-width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 140ms ease-out, color 140ms ease-out, transform 120ms ease-out;
}

.chrome-btn.text {
  font-size: 12px;
  font-weight: 500;
  padding: 0 10px;
  min-width: 40px;
}

.chrome-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.9);
}

.chrome-btn:active {
  transform: scale(0.96);
}

.zoom-label {
  min-width: 44px;
  text-align: center;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.45);
  font-family: var(--font-code);
}

.chrome-divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 4px;
}

.chrome-hint {
  margin-left: auto;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.28);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
