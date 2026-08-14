import { invoke } from '@tauri-apps/api/core'

import { notify, isTauri } from '@/services/notification'
import { SHOP_API_BASE } from '@/services/petShop'
import { usePetStore } from '@/stores/pet'
import type { NoticeContent } from '@/types/update'

export interface NoticesResponse {
  items: NoticeContent[]
}

const NOTICE_POLL_INTERVAL = import.meta.env.DEV ? 10_000 : 30 * 60 * 1000

const MOCK_NOTICES: NoticeContent[] = [
  {
    id: 'announcement:demo',
    kind: 'announcement',
    title: 'Frieren Pet 限时活动',
    subtitle: '活动说明',
    body: '即日起至 8 月底，安装任意商店角色可解锁隐藏彩蛋。\n详情请在商店页查看。',
    publishedAt: '2026-08-14T00:00:00Z',
    actions: [{ label: '去商店看看', kind: 'open-url', url: 'https://shop.example.com' }],
  },
]

export function pushNotice(notice: NoticeContent, withSystemNotification = true): void {
  const petStore = usePetStore()

  petStore.pendingNotice = notice

  if (withSystemNotification) {
    void notify(notice.title, notice.subtitle ?? notice.body.slice(0, 80))
  }
}

export function dismissNotice(id: string): void {
  const petStore = usePetStore()

  if (!petStore.dismissedNoticeIds.includes(id)) {
    petStore.dismissedNoticeIds.push(id)
  }

  if (petStore.pendingNotice?.id === id) {
    petStore.pendingNotice = null
  }
}

export function isNoticeDismissed(id: string): boolean {
  const petStore = usePetStore()

  return petStore.dismissedNoticeIds.includes(id)
}

async function fetchNoticesFromServer(): Promise<NoticeContent[]> {
  const response = (await invoke('fetch_notices', { baseUrl: SHOP_API_BASE })) as NoticesResponse

  return response.items ?? []
}

export async function fetchNotices(): Promise<NoticeContent[]> {
  if (!isTauri()) return MOCK_NOTICES

  try {
    return await fetchNoticesFromServer()
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[frieren-pet] notices: fetch failed, skip:', error)

      return []
    }

    throw error
  }
}

export async function pollAndPushNotices(): Promise<void> {
  const petStore = usePetStore()

  if (!petStore.autoCheckUpdates) return

  let items: NoticeContent[]

  try {
    items = await fetchNotices()
  } catch (error) {
    console.error('[frieren-pet] notices: fetch failed:', error)

    return
  }

  for (const item of items) {
    if (petStore.notifiedNoticeIds.includes(item.id)) continue

    petStore.notifiedNoticeIds.push(item.id)
    pushNotice(item)
  }
}

export function scheduleNoticePolling(): () => void {
  const timer = window.setInterval(() => {
    void pollAndPushNotices()
  }, NOTICE_POLL_INTERVAL)

  return () => window.clearInterval(timer)
}
