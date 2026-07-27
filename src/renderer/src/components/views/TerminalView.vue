<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { Ghostty, Terminal, FitAddon } from 'ghostty-web'
import ghosttyWasmUrl from 'ghostty-web/ghostty-vt.wasm?url'
import { useProjectsStore } from '../../stores/projects'

const projectsStore = useProjectsStore()
const { activeProject } = storeToRefs(projectsStore)

const terminalContainer = ref<HTMLElement | null>(null)

// Unique session ID for this terminal instance
const sessionId = crypto.randomUUID()

let term: InstanceType<typeof Terminal> | null = null
let fitAddon: InstanceType<typeof FitAddon> | null = null
let resizeObserver: ResizeObserver | null = null
let isDisposed = false

// Throttle resize calls — PTY resize is cheap but no need to hammer it
let resizeThrottle: ReturnType<typeof setTimeout> | null = null

function schedulePtyResize() {
  if (resizeThrottle) clearTimeout(resizeThrottle)
  resizeThrottle = setTimeout(() => {
    if (!term || !fitAddon || isDisposed) return
    fitAddon.fit()
    const dims = fitAddon.proposeDimensions()
    if (dims) {
      window.api.pty.resize(sessionId, dims.cols, dims.rows)
    }
  }, 60)
}

onMounted(async () => {
  if (!terminalContainer.value) return

  try {
    // Load Ghostty WASM via Vite-resolved asset URL (works in both dev + prod Electron)
    const ghostty = await Ghostty.load(ghosttyWasmUrl)

    term = new Terminal({
      ghostty,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1C1C2A',
        foreground: '#E2E8F0',
        cursor: '#FF5F5F',
        selectionBackground: 'rgba(255, 255, 255, 0.15)',
        black:          '#1C1C2A',
        red:            '#FF5F5F',
        green:          '#08C371',
        yellow:         '#f1fa8c',
        blue:           '#bd93f9',
        magenta:        '#ff79c6',
        cyan:           '#8be9fd',
        white:          '#f8f8f2',
        brightBlack:    '#6272a4',
        brightRed:      '#ff6e6e',
        brightGreen:    '#69ff94',
        brightYellow:   '#ffffa5',
        brightBlue:     '#d6acff',
        brightMagenta:  '#ff92df',
        brightCyan:     '#a4ffff',
        brightWhite:    '#ffffff',
      }
    })

    fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalContainer.value)
    fitAddon.fit()

    // Get initial dimensions
    const dims = fitAddon.proposeDimensions() ?? { cols: 80, rows: 24 }

    // Spawn real shell in the active project directory (falls back to $HOME)
    const cwd = activeProject.value?.path || ''
    await window.api.pty.create(sessionId, dims.cols, dims.rows, cwd)

    // Shell → Terminal: pipe PTY output into Ghostty for rendering
    window.api.pty.onData(sessionId, (data: string) => {
      if (!isDisposed) term?.write(data)
    })

    // Shell exited — show a faint notice and allow restart
    window.api.pty.onExit(sessionId, (exitCode: number) => {
      if (!isDisposed) {
        term?.write(`\r\n\x1b[2m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
      }
    })

    // Terminal → Shell: pipe keystrokes / paste to the PTY
    term.onData((data: string) => {
      if (!isDisposed) window.api.pty.write(sessionId, data)
    })

    // Refit + resize PTY when the panel dimensions change
    resizeObserver = new ResizeObserver(() => schedulePtyResize())
    resizeObserver.observe(terminalContainer.value)

  } catch (err) {
    console.error('[Terminal] Failed to initialize:', err)
    if (terminalContainer.value) {
      terminalContainer.value.innerHTML = `
        <div class="terminal-error">
          <span class="error-title">Terminal unavailable</span>
          <span class="error-detail">${err instanceof Error ? err.message : 'Unknown error'}</span>
        </div>
      `
    }
  }
})

onUnmounted(() => {
  isDisposed = true
  if (resizeThrottle) clearTimeout(resizeThrottle)
  resizeObserver?.disconnect()
  // Remove IPC listeners before killing so the exit event doesn't fire into a dead component
  window.api.pty.removeListeners(sessionId)
  window.api.pty.kill(sessionId)
  term?.dispose()
  resizeObserver = null
  fitAddon = null
  term = null
})
</script>

<template>
  <div class="terminal-view-container">
    <div class="terminal-wrapper" ref="terminalContainer"></div>
  </div>
</template>

<style scoped>
.terminal-view-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: transparent;
  box-sizing: border-box;
  padding-bottom: var(--bottom-bar-clearance);
}

.terminal-wrapper {
  flex: 1;
  width: 100%;
  min-height: 0;
  padding: 8px;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

:deep(canvas) {
  display: block;
}

:deep(.terminal-error) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
}

:deep(.error-title) {
  color: var(--accent);
}

:deep(.error-detail) {
  opacity: 0.6;
  font-size: 11px;
}
</style>
