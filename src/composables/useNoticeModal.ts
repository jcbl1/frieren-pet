import { ref } from 'vue'

import type { NoticeContent } from '@/types/update'

const visible = ref(false)
const current = ref<NoticeContent | null>(null)

export function useNoticeModal() {
  function open(notice: NoticeContent) {
    current.value = notice
    visible.value = true
  }

  function close() {
    visible.value = false
  }

  return { visible, current, open, close }
}
