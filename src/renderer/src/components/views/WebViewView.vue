<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft, ArrowRight, RotateCw } from 'lucide-vue-next'

const url = ref('https://google.com')
const webviewRef = ref<any>(null)
const canGoBack = ref(false)
const canGoForward = ref(false)

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
</script>

<template>
  <div class="webview-container">
    <div class="address-bar">
      <button class="nav-btn" :disabled="!canGoBack" @click="goBack"><ArrowLeft :size="16" /></button>
      <button class="nav-btn" :disabled="!canGoForward" @click="goForward"><ArrowRight :size="16" /></button>
      <button class="nav-btn" @click="reload"><RotateCw :size="16" /></button>
      <input 
        v-model="url" 
        @keyup.enter="loadUrl" 
        class="url-input" 
        type="text" 
        placeholder="Enter URL..." 
      />
    </div>
    <webview
      ref="webviewRef"
      class="webview-element"
      src="https://google.com"
      @did-navigate="onDidNavigate"
      @did-navigate-in-page="onDidNavigate"
    ></webview>
  </div>
</template>

<style scoped>
.webview-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: transparent;
}

.address-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: transparent;
  border-bottom: 1px solid var(--border-color);
  -webkit-app-region: drag;
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

.webview-element {
  flex: 1;
  width: 100%;
  height: 100%;
  border: none;
  background-color: #ffffff; /* Web pages expect white backgrounds usually */
}
</style>
