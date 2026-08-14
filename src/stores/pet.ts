import { defineStore } from 'pinia'

import type { NoticeContent } from '@/types/update'

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface PetStoreState {
  currentPetId: string | null
  scale: number
  alwaysOnTop: boolean
  opacity: number
  passThrough: boolean
  idleEnabled: boolean
  idleAfterMs: number | null
  x: number | null
  y: number | null
  theme: ThemeMode
  autoCheckUpdates: boolean
  pendingNotices: NoticeContent[]
  dismissedNoticeIds: string[]
  notifiedNoticeIds: string[]
}

export const usePetStore = defineStore('pet', {
  state: (): PetStoreState => ({
    currentPetId: 'frieren',
    scale: 100,
    alwaysOnTop: true,
    opacity: 100,
    passThrough: false,
    idleEnabled: true,
    idleAfterMs: null,
    x: null,
    y: null,
    theme: 'auto',
    autoCheckUpdates: true,
    pendingNotices: [],
    dismissedNoticeIds: [],
    notifiedNoticeIds: [],
  }),
})
