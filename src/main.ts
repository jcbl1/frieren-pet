import { createPlugin } from '@tauri-store/pinia'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { appLogger } from './services/logger'

import './assets/css/main.css'

const pinia = createPinia()
pinia.use(createPlugin({ saveOnChange: true }))

const app = createApp(App)

app.config.errorHandler = (error, _instance, info) => {
  appLogger.error('vue error', { error, info })
}

window.addEventListener('error', (event) => {
  appLogger.error('uncaught error', { error: event.error ?? event.message, source: event.filename, line: event.lineno })
})

window.addEventListener('unhandledrejection', (event) => {
  appLogger.error('unhandled rejection', event.reason)
})

app.use(pinia).use(router).mount('#app')
