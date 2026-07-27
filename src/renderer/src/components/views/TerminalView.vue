<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { init, Terminal } from 'ghostty-web'
import { Terminal as TerminalIcon } from 'lucide-vue-next'

const terminalContainer = ref<HTMLElement | null>(null)
let term: any = null

onMounted(async () => {
  if (!terminalContainer.value) return

  // Initialize the WebAssembly module for Ghostty
  await init()

  // Instantiate the terminal
  term = new Terminal({
    fontSize: 14,
    theme: {
      background: '#1C1C2A', // Match var(--bg-panel)
      foreground: '#E2E8F0', // Match var(--text-main)
      cursor: '#FF5F5F',     // Match var(--accent)
      selection: 'rgba(255, 255, 255, 0.1)',
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

  term.open(terminalContainer.value)
  
  // Basic welcome message
  term.write('Welcome to Kraken Terminal (Powered by Ghostty Web)\\r\\n')
  term.write('$ ')

  // Basic local echo for demonstration purposes (until a real PTY is hooked up)
  term.onData((data: string) => {
    // Handle Enter key
    if (data === '\\r') {
      term.write('\\r\\n$ ')
    } 
    // Handle Backspace
    else if (data === '\\x7f') {
      term.write('\\b \\b')
    } 
    // Handle normal characters
    else {
      term.write(data)
    }
  })
})

onUnmounted(() => {
  if (term) {
    term.dispose()
  }
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
}

/* Ensure the canvas or terminal element takes full height */
:deep(.xterm), :deep(.ghostty-web) {
  height: 100%;
  width: 100%;
}
</style>
