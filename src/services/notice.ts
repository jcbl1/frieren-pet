import { usePetStore } from '@/stores/pet'
import { notify } from '@/services/notification'
import type { NoticeContent } from '@/types/update'

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
