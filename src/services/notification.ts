import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'

import { createLogger } from '@/services/logger'
import { usePetStore } from '@/stores/pet'

const logger = createLogger('notification')

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
    logger.error('permission request failed', error)

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
    logger.error('send notification failed', error)
  }
}
