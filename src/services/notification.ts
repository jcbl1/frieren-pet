import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'

import { usePetStore } from '@/stores/pet'

export function isTauri() {
  return '__TAURI_INTERNALS__' in window
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isTauri()) return false

  try {
    let granted = await isPermissionGranted()

    if (!granted) {
      granted = (await requestPermission()) === 'granted'
    }

    return granted
  } catch (error) {
    console.error('[frieren-pet] notification permission request failed:', error)

    return false
  }
}

export async function notify(title: string, body: string): Promise<void> {
  if (!isTauri()) return

  if (!usePetStore().systemNotifications) return

  const granted = await ensureNotificationPermission()

  if (!granted) return

  try {
    sendNotification({ title, body })
  } catch (error) {
    console.error('[frieren-pet] send notification failed:', error)
  }
}
