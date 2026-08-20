import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // eve uses Node.js # subpath imports that Vite cannot resolve at
        // bundle time. Externalize it so it resolves at runtime from
        // node_modules, where the package's "imports" field is honored.
        external: ['eve', 'eve/client', 'eve/tools']
      }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    worker: {
      format: 'es'
    },
    plugins: [vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'webview'
        }
      }
    })]
  }
})
