<script setup lang="ts">
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onMounted, onBeforeUnmount } from 'vue'
import { RouterView, useRouter } from 'vue-router'

import { useTheme } from '@/composables/useTheme'
import {
  enqueueNotices,
  pollAndPushNotices,
  resetNoticeSession,
  scheduleNoticePolling,
} from '@/services/notice'
import { checkForUpdate, updateToNotice } from '@/services/updater'
import { usePetStore } from '@/stores/pet'

const appWindow = getCurrentWebviewWindow()
const petStore = usePetStore()
const router = useRouter()

function isTauri() {
  return '__TAURI_INTERNALS__' in window
}

let unlistenShop: (() => void) | undefined
let unlistenTheme: (() => void) | undefined
let stopNoticePolling: (() => void) | undefined

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

  if (appWindow.label === 'main') {
    resetNoticeSession()

    window.setTimeout(() => {
      if (!petStore.autoCheckUpdates) return

      void checkForUpdate().then((info) => {
        if (info) enqueueNotices([updateToNotice(info)], { notify: true })
      })
    }, 8000)

    window.setTimeout(() => {
      void pollAndPushNotices()
    }, 10_000)

    stopNoticePolling = scheduleNoticePolling()
  }
})

onBeforeUnmount(() => {
  unlistenShop?.()
  unlistenTheme?.()
  stopNoticePolling?.()
})
</script>

<template>
  <RouterView />
</template>
