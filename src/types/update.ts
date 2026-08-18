export interface UpdateInfo {
  version: string
  title: string
  notes: string | null
  releaseUrl: string
  publishedAt: string | null
  downloadUrl: string | null
}

export type NoticeKind = 'update' | 'announcement'

export interface NoticeAction {
  label: string
  kind: 'open-url' | 'download'
  url?: string
}

export interface NoticeContent {
  id: string
  kind: NoticeKind
  title: string
  subtitle?: string
  body: string
  publishedAt?: string
  actions?: NoticeAction[]
}
