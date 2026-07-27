<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Ghostty, Terminal, FitAddon } from 'ghostty-web'
import { Terminal as TerminalIcon } from 'lucide-vue-next'
// Vite bundles the .wasm file as a static asset and returns the correct URL
// for both dev (localhost) and production (file://) Electron contexts.
import ghosttyWasmUrl from 'ghostty-web/ghostty-vt.wasm?url'

const terminalContainer = ref<HTMLElement | null>(null)
let term: InstanceType<typeof Terminal> | null = null
let fitAddon: InstanceType<typeof FitAddon> | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  if (!terminalContainer.value) return

  try {
    // Load Ghostty WASM using the Vite-resolved asset URL.
    // This bypasses ghostty-web's broken file:// path resolution in Electron.
    const ghostty = await Ghostty.load(ghosttyWasmUrl)

    // Create terminal, passing the loaded Ghostty instance directly
    // to skip the global init() requirement.
    term = new Terminal({
      ghostty,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1C1C2A',
        foreground: '#E2E8F0',
        cursor: '#FF5F5F',
        selectionBackground: 'rgba(255, 255, 255, 0.1)',
        black: '#1C1C2A',
        red: '#FF5F5F',
        green: '#08C371',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff'
      }
    })

    // FitAddon fills the terminal to its container dimensions
    fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    // Mount into DOM, then fit
    term.open(terminalContainer.value)
    fitAddon.fit()

    // Refit whenever the panel is resized
    resizeObserver = new ResizeObserver(() => {
      fitAddon?.fit()
    })
    resizeObserver.observe(terminalContainer.value)

    // Welcome prompt
    term.write('\x1b[1;32mKraken Terminal\x1b[0m\r\n')
    term.write('\x1b[2m(local echo — no shell attached)\x1b[0m\r\n\r\n')
    term.write('$ ')

    // Local echo with basic line editing
    let currentLine = ''

    term.onData((data: string) => {
      if (!term) return

      if (data === '\r') {
        // Enter — submit line
        term.write('\r\n')
        if (currentLine.trim()) {
          term.write(`\x1b[33m${currentLine.trim()}\x1b[0m: command not found\r\n`)
        }
        currentLine = ''
        term.write('$ ')
      } else if (data === '\x7f') {
        // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1)
          term.write('\b \b')
        }
      } else if (data === '\x03') {
        // Ctrl+C — cancel line
        term.write('^C\r\n$ ')
        currentLine = ''
      } else if (data === '\x0c') {
        // Ctrl+L — clear screen
        term.write('\x1b[2J\x1b[H$ ' + currentLine)
      } else if (data >= ' ') {
        // Printable character
        currentLine += data
        term.write(data)
      }
    })
  } catch (err) {
    console.error('[Terminal] Ghostty WASM failed to load:', err)
    if (terminalContainer.value) {
      terminalContainer.value.innerHTML = `
        <div class="terminal-error">
          <span class="error-title">Terminal unavailable</span>
          <span class="error-detail">Ghostty WASM could not be loaded</span>
        </div>
      `
    }
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  term?.dispose()
  resizeObserver = null
  fitAddon = null
  term = null
})
</script>

<template>
  <div class="terminal-view-container">
    <div class="terminal-header">
      <div class="header-title">
        <TerminalIcon :size="14" />
        <span>Terminal</span>
      </div>
    </div>
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
}

.terminal-header {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  background-color: transparent;
  border-bottom: 1px solid var(--border-color);
  -webkit-app-region: drag;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
}

.terminal-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 8px;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

/* Ensure Ghostty's canvas fills the wrapper */
:deep(canvas) {
  display: block;
}

/* Error fallback styling */
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
