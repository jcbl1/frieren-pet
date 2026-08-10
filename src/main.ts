import { createPlugin } from '@tauri-store/pinia'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'

import './assets/css/main.css'

const pinia = createPinia()
pinia.use(createPlugin({ saveOnChange: true }))

createApp(App).use(pinia).use(router).mount('#app')
