<script setup lang="ts">
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onMounted, onBeforeUnmount } from 'vue'
import { RouterView, useRouter } from 'vue-router'

import { usePetStore } from '@/stores/pet'

const appWindow = getCurrentWebviewWindow()
const petStore = usePetStore()
const router = useRouter()

function isTauri() {
  return '__TAURI_INTERNALS__' in window
}

let unlistenShop: (() => void) | undefined

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

  if (appWindow.label === 'preference') {
    unlistenShop = await listen('open-shop-tab', () => {
      void router.push('/preference/shop')
    })
  }
})

onBeforeUnmount(() => {
  unlistenShop?.()
})
</script>

<template>
  <RouterView />
</template>
