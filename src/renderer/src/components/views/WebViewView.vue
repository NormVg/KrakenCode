<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft, ArrowRight, RotateCw, Monitor, Smartphone } from 'lucide-vue-next'

const url = ref('https://google.com')
const webviewRef = ref<any>(null)
const canGoBack = ref(false)
const canGoForward = ref(false)
const viewMode = ref<'desktop' | 'mobile'>('desktop')

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
  }
}

const setViewMode = (mode: 'desktop' | 'mobile') => {
  viewMode.value = mode
  // Optionally, you can set the user agent for mobile here if needed
  if (webviewRef.value) {
    if (mode === 'mobile') {
      webviewRef.value.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1')
    } else {
      // Set to default desktop user agent (empty means default)
      webviewRef.value.setUserAgent(navigator.userAgent)
    }
    webviewRef.value.reload()
  }
}
</script>

<template>
  <div class="webview-container">
    <div class="address-bar">
      <div class="nav-group">
        <button class="nav-btn" :disabled="!canGoBack" @click="goBack"><ArrowLeft :size="16" /></button>
        <button class="nav-btn" :disabled="!canGoForward" @click="goForward"><ArrowRight :size="16" /></button>
        <button class="nav-btn" @click="reload"><RotateCw :size="16" /></button>
      </div>
      
      <input 
        v-model="url" 
        @keyup.enter="loadUrl" 
        class="url-input" 
        type="text" 
        placeholder="Enter URL..." 
      />
      
      <div class="view-toggles">
        <button 
          class="nav-btn" 
          :class="{ 'active': viewMode === 'desktop' }" 
          @click="setViewMode('desktop')"
          title="Desktop View"
        >
          <Monitor :size="16" />
        </button>
        <button 
          class="nav-btn" 
          :class="{ 'active': viewMode === 'mobile' }" 
          @click="setViewMode('mobile')"
          title="Mobile View"
        >
          <Smartphone :size="16" />
        </button>
      </div>
    </div>
    <div class="webview-stage" :class="viewMode">
      <div class="device-frame" :class="viewMode">
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
  background-color: var(--bg-panel); /* Blend with surroundings */
}

.address-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background-color: transparent;
  border-bottom: 1px solid var(--border-color);
  -webkit-app-region: drag;
}

.nav-group, .view-toggles {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: no-drag;
}
.nav-btn:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-main);
}
.nav-btn.active {
  background-color: rgba(255, 255, 255, 0.15);
  color: var(--text-main);
}
.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.url-input {
  flex: 1;
  background-color: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--text-main);
  padding: 6px 12px;
  border-radius: 6px;
  font-family: var(--font-primary);
  font-size: 13px;
  outline: none;
  -webkit-app-region: no-drag;
}
.url-input:focus {
  border-color: rgba(255, 255, 255, 0.2);
}

.webview-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0A0D18; /* Dark backdrop for the stage */
  overflow: auto;
  position: relative;
}

.webview-stage.desktop {
  /* In desktop mode, we just want the frame to fill everything seamlessly */
  background-color: transparent;
}

.device-frame {
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  background-color: #ffffff;
}

/* Mobile Frame Styling */
.device-frame.mobile {
  width: 375px;
  height: 812px;
  border-radius: 36px;
  border: 12px solid #111;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  /* Optional: a little top notch fake */
}
.device-frame.mobile::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 24px;
  background-color: #111;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  z-index: 10;
}

/* Desktop Frame Styling */
.device-frame.desktop {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 0;
}

.webview-element {
  width: 100%;
  height: 100%;
  border: none;
  display: block; /* Removes bottom spacing issues */
}
</style>
