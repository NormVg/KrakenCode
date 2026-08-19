import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { initMarkstream } from './plugins/markstream'

// Enable Mermaid + KaTeX rendering before any chat message mounts.
initMarkstream()

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
