<script setup lang="ts">
import { ref, computed } from 'vue'
import { ArrowLeft, ArrowRight, RotateCw, Monitor, Smartphone, Layout } from 'lucide-vue-next'

const url = ref('https://google.com')
const webviewRef = ref<any>(null)
const canGoBack = ref(false)
const canGoForward = ref(false)

type DeviceMode = 'desktop' | 'mobile' | 'responsive'
const viewMode = ref<DeviceMode>('desktop')

// Responsive dimensions
const customWidth = ref(800)
const customHeight = ref(600)
const zoomLevel = ref(100)

const loadUrl = () => {
  if (webviewRef.value) {
    let finalUrl = url.value
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl
    }
    webviewRef.value.loadURL(finalUrl)
  }
}

const goBack = () => {
  if (webviewRef.value && canGoBack.value) {
    webviewRef.value.goBack()
  }
}

const goForward = () => {
  if (webviewRef.value && canGoForward.value) {
    webviewRef.value.goForward()
  }
}

const reload = () => {
  if (webviewRef.value) {
    webviewRef.value.reload()
  }
}

const onDidNavigate = (e: any) => {
  url.value = e.url
  if (webviewRef.value) {
    canGoBack.value = webviewRef.value.canGoBack()
    canGoForward.value = webviewRef.value.canGoForward()
    // Force reset any cached internal browser zoom (e.g., from pinch-to-zoom)
    webviewRef.value.setZoomLevel(0)
  }
}

const userAgents = [
  { label: 'Default Browser', value: 'default' },
  { label: 'Chrome (Windows)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36' },
  { label: 'Chrome (macOS)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36' },
  { label: 'iPhone (Safari)', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' },
  { label: 'iPad (Safari)', value: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' },
  { label: 'Android (Chrome)', value: 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36' },
]

const currentUserAgent = ref('default')

const applyUserAgent = () => {
  if (webviewRef.value) {
    if (currentUserAgent.value === 'default') {
      webviewRef.value.setUserAgent(navigator.userAgent)
    } else {
      webviewRef.value.setUserAgent(currentUserAgent.value)
    }
    // Force reset any cached internal browser zoom
    webviewRef.value.setZoomLevel(0)
    webviewRef.value.reload()
  }
}

const setViewMode = (mode: DeviceMode) => {
  viewMode.value = mode
  
  if (mode === 'responsive' && stageRef.value) {
    const rect = stageRef.value.getBoundingClientRect()
    customWidth.value = Math.max(320, Math.floor(rect.width - 48))
    customHeight.value = Math.max(480, Math.floor(rect.height - 48))
  }

  if (mode === 'mobile') {
    currentUserAgent.value = userAgents[3].value // iPhone Safari
  } else if (mode === 'desktop') {
    currentUserAgent.value = 'default'
  }
  
  applyUserAgent()
}

// Computed styles for the device frame
const frameStyle = computed(() => {
  if (viewMode.value === 'desktop') {
    return {
      width: '100%',
      height: '100%',
      transform: `scale(${zoomLevel.value / 100})`,
      transformOrigin: 'center'
    }
  }
  
  if (viewMode.value === 'mobile') {
    return {
      width: '375px',
      height: '812px',
      transform: `scale(${zoomLevel.value / 100})`,
      transformOrigin: 'top center'
    }
  }

  // Responsive mode
  return {
    width: `${customWidth.value}px`,
    height: `${customHeight.value}px`,
    transform: `scale(${zoomLevel.value / 100})`,
    transformOrigin: 'top center'
  }
})

import { onMounted, onUnmounted } from 'vue'

const stageRef = ref<HTMLElement | null>(null)
const frameRef = ref<HTMLElement | null>(null)
let frameResizeObserver: ResizeObserver | null = null

onMounted(() => {
  // Initialize responsive size to fit the stage (minus padding)
  if (stageRef.value) {
    const rect = stageRef.value.getBoundingClientRect()
    // Stage has 24px padding on all sides, so subtract 48px
    customWidth.value = Math.max(320, Math.floor(rect.width - 48))
    customHeight.value = Math.max(480, Math.floor(rect.height - 48))
  }

  // Observe the frame so CSS `resize: both` updates the Vue state
  if (frameRef.value) {
    frameResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (viewMode.value === 'responsive') {
          // Update state when user drags the CSS resize handle
          // Avoid infinite loops by checking if it actually changed
          const newW = entry.contentRect.width
          const newH = entry.contentRect.height
          if (Math.abs(newW - customWidth.value) > 2) {
            customWidth.value = Math.round(newW)
          }
          if (Math.abs(newH - customHeight.value) > 2) {
            customHeight.value = Math.round(newH)
          }
        }
      }
    })
    frameResizeObserver.observe(frameRef.value)
  }
})

onUnmounted(() => {
  if (frameResizeObserver) {
    frameResizeObserver.disconnect()
  }
})
</script>

<template>
  <div class="webview-container">
    
    <!-- Unified Top Toolbar -->
    <div class="address-bar">
      <!-- Navigation -->
      <div class="nav-group">
        <button class="nav-btn" :disabled="!canGoBack" @click="goBack"><ArrowLeft :size="16" /></button>
        <button class="nav-btn" :disabled="!canGoForward" @click="goForward"><ArrowRight :size="16" /></button>
        <button class="nav-btn" @click="reload"><RotateCw :size="14" /></button>
      </div>
      
      <!-- URL Bar -->
      <div class="url-bar-wrapper">
        <input 
          v-model="url" 
          @keyup.enter="loadUrl" 
          class="url-input" 
          type="text" 
          placeholder="Enter URL..." 
          spellcheck="false"
        />
      </div>

      <div class="toolbar-divider"></div>

      <!-- Mode Toggles -->
      <div class="toolbar-group">
        <button class="tool-btn" :class="{ 'active': viewMode === 'desktop' }" @click="setViewMode('desktop')" title="Desktop">
          <Monitor :size="14" />
        </button>
        <button class="tool-btn" :class="{ 'active': viewMode === 'responsive' }" @click="setViewMode('responsive')" title="Responsive">
          <Layout :size="14" />
        </button>
        <button class="tool-btn" :class="{ 'active': viewMode === 'mobile' }" @click="setViewMode('mobile')" title="Mobile">
          <Smartphone :size="14" />
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Dimensions -->
      <div class="toolbar-group dimensions-group" :class="{ 'disabled': viewMode !== 'responsive' }">
        <input type="number" v-model="customWidth" class="dim-input" :disabled="viewMode !== 'responsive'"/>
        <span class="dim-separator">×</span>
        <input type="number" v-model="customHeight" class="dim-input" :disabled="viewMode !== 'responsive'"/>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Zoom -->
      <div class="toolbar-group">
        <select v-model="zoomLevel" class="toolbar-select">
          <option :value="50">50%</option>
          <option :value="75">75%</option>
          <option :value="100">100%</option>
          <option :value="125">125%</option>
          <option :value="150">150%</option>
        </select>
      </div>

      <div class="toolbar-divider"></div>

      <!-- User Agent -->
      <div class="toolbar-group">
        <select v-model="currentUserAgent" @change="applyUserAgent" class="toolbar-select user-agent-select">
          <option v-for="agent in userAgents" :key="agent.label" :value="agent.value">{{ agent.label }}</option>
        </select>
      </div>
    </div>

    <!-- 3. Workspace Stage -->
    <div class="webview-stage" :class="viewMode" ref="stageRef">
      <div class="device-frame" :class="viewMode" :style="frameStyle" ref="frameRef">
        <webview
          ref="webviewRef"
          class="webview-element"
          src="https://google.com"
          @did-navigate="onDidNavigate"
          @did-navigate-in-page="onDidNavigate"
        ></webview>
      </div>
    </div>

  </div>
</template>

<style scoped>
.webview-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: var(--bg-panel);
}

/* ─── Address Bar ────────────────────────────────────────────────────────── */
.address-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background-color: var(--bg-dark);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
  flex-wrap: wrap;
  -webkit-app-region: drag;
}

.nav-group,
.url-bar-wrapper,
.toolbar-group {
  -webkit-app-region: no-drag;
}

.nav-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-btn {
  background: transparent;
  border: none;
  color: var(--text-main);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.nav-btn:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.1);
}
.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.url-bar-wrapper {
  flex: 1;
  min-width: 200px;
  background-color: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
}
.url-bar-wrapper:focus-within {
  background-color: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.url-input {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-main);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.toolbar-group.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.toolbar-divider {
  width: 1px;
  height: 16px;
  background-color: rgba(255, 255, 255, 0.1);
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--text-muted-dark);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  transition: all 0.2s ease;
}
.tool-btn:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
}
.tool-btn.active {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
}

/* Dimensions Input */
.dim-input {
  width: 60px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-main);
  font-family: var(--font-code);
  font-size: 12px;
  text-align: center;
  padding: 2px 4px;
  border-radius: 4px;
}
.dim-input:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.1);
}
.dim-input:focus {
  background: rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.2);
  outline: none;
}
.dim-separator {
  color: var(--text-muted-dark);
  font-size: 12px;
}

/* Select Dropdowns */
.toolbar-select {
  background: transparent;
  border: none;
  color: var(--text-main);
  font-size: 12px;
  cursor: pointer;
  outline: none;
  padding: 2px;
  max-width: 150px;
  text-overflow: ellipsis;
}
.toolbar-select option {
  background-color: var(--bg-panel);
}

.user-agent-select {
  max-width: 140px;
}

/* ─── Workspace Stage ────────────────────────────────────────────────────── */
.webview-stage {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  
  /* Technical background hash pattern */
  background-color: #0d0f16;
  background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 16px 16px;
  
  overflow: auto;
  position: relative;
  padding: 24px;
  padding-bottom: var(--bottom-bar-clearance, 80px);
}

/* Desktop mode has no padding, fills stage */
.webview-stage.desktop {
  padding: 0;
  padding-bottom: var(--bottom-bar-clearance, 80px);
  align-items: stretch;
}

.device-frame {
  position: relative;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease, height 0.2s ease;
}

/* Responsive & Mobile add borders and shadow */
.device-frame.mobile,
.device-frame.responsive {
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

/* For resizing in responsive mode, we use CSS resize */
.device-frame.responsive {
  resize: both;
  overflow: hidden;
  /* Override inline styles during manual resize */
  max-width: 100%;
  max-height: 100%;
}

/* Desktop Frame Styling */
.device-frame.desktop {
  flex: 1;
  border: none;
  border-radius: 0;
  transition: none;
}

.webview-element {
  flex: 1;
  width: 100%;
  height: 100%;
  border: none;
}
</style>
