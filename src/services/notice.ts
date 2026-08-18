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

function mergedNotification(notices: NoticeContent[]) {
  if (notices.length === 0) return

  const first = notices[0]

  if (notices.length === 1) {
    void notify(first.title, first.subtitle ?? first.body.slice(0, 80))

    return
  }

  void notify(`${notices.length} 条新公告`, first.subtitle ?? first.title)
}

export function enqueueNotices(
  notices: NoticeContent[],
  { notify: withNotification }: { notify: boolean },
): void {
  const petStore = usePetStore()

  const existing = new Set(petStore.pendingNotices.map((notice) => notice.id))

  const toAdd = notices.filter(
    (notice) => !existing.has(notice.id) && !petStore.dismissedNoticeIds.includes(notice.id),
  )

  if (toAdd.length > 0) {
    petStore.pendingNotices.push(...toAdd)
  }

  if (withNotification && toAdd.length > 0) {
    mergedNotification(toAdd)
  }
}

export function dequeueNotice(id: string): NoticeContent | null {
  const petStore = usePetStore()

  const index = petStore.pendingNotices.findIndex((notice) => notice.id === id)

  if (index === -1) return null

  return petStore.pendingNotices.splice(index, 1)[0]
}

export function dismissNotice(id: string): void {
  const petStore = usePetStore()

  if (!petStore.dismissedNoticeIds.includes(id)) {
    petStore.dismissedNoticeIds.push(id)
  }

  dequeueNotice(id)
}

export function resetNoticeSession(): void {
  const petStore = usePetStore()

  petStore.pendingNotices = []
  petStore.dismissedNoticeIds = []
  petStore.notifiedNoticeIds = []
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

  let items: NoticeContent[]

  try {
    items = await fetchNotices()
  } catch (error) {
    console.error('[frieren-pet] notices: fetch failed:', error)

    return
  }

  const fresh = items.filter((item) => !petStore.notifiedNoticeIds.includes(item.id))

  if (fresh.length === 0) return

  for (const item of fresh) {
    petStore.notifiedNoticeIds.push(item.id)
  }

  enqueueNotices(fresh, { notify: true })
}

export function scheduleNoticePolling(): () => void {
  const timer = window.setInterval(() => {
    void pollAndPushNotices()
  }, NOTICE_POLL_INTERVAL)

  return () => window.clearInterval(timer)
}
