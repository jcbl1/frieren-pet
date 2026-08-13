<script setup lang="ts">
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onMounted, onBeforeUnmount } from 'vue'
import { RouterView, useRouter } from 'vue-router'

import { useTheme } from '@/composables/useTheme'
import { usePetStore } from '@/stores/pet'

const appWindow = getCurrentWebviewWindow()
const petStore = usePetStore()
const router = useRouter()

function isTauri() {
  return '__TAURI_INTERNALS__' in window
}

let unlistenShop: (() => void) | undefined
let unlistenTheme: (() => void) | undefined

onMounted(async () => {
  if (appWindow.label === 'preference') {
    document.body.classList.add('preference')
  }

  unlistenTheme = useTheme(() => petStore.theme)

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
  unlistenTheme?.()
})
</script>

<template>
  <RouterView />
</template>
