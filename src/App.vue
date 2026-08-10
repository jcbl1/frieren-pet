<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

import { usePetStore } from '@/stores/pet'

const appWindow = getCurrentWebviewWindow()
const petStore = usePetStore()

function isTauri() {
  return '__TAURI_INTERNALS__' in window
}

onMounted(async () => {
  if (appWindow.label === 'preference') {
    document.body.classList.add('preference')
  }

  if (!isTauri()) return

  try {
    await petStore.$tauri.start()
  } catch (error) {
    console.error('[frieren-pet] store sync start failed:', error)
  }
})
</script>

<template>
  <RouterView />
</template>
