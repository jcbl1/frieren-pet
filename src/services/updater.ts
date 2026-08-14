import { invoke } from '@tauri-apps/api/core'

import type { NoticeContent, UpdateInfo } from '@/types/update'
import { isTauri } from '@/services/notification'

export const UPDATE_SOURCE = 'https://github.com/jcbl1/frieren-pet/releases'

const MOCK_UPDATE: UpdateInfo = {
  version: '1.1.0',
  title: 'Frieren Pet v1.1.0',
  notes: '新增功能：\n- 系统通知与设置窗口横幅\n- 应用内更新检查与下载',
  releaseUrl: `${UPDATE_SOURCE}/tag/v1.1.0`,
  publishedAt: '2026-08-14T00:00:00Z',
  downloadUrl: null,
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return MOCK_UPDATE

  return (await invoke('check_for_update')) as UpdateInfo | null
}

export async function downloadAndOpen(url: string): Promise<string> {
  if (!isTauri()) {
    throw new Error('浏览器预览模式不支持下载安装包')
  }

  const path = (await invoke('download_release_asset', { url })) as string

  const { openPath } = await import('@tauri-apps/plugin-opener')

  await openPath(path)

  return path
}

export async function openReleasePage(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, '_blank')

    return
  }

  const { openUrl } = await import('@tauri-apps/plugin-opener')

  await openUrl(url)
}

export function updateToNotice(info: UpdateInfo): NoticeContent {
  const actions: NoticeContent['actions'] = []

  if (info.downloadUrl) {
    actions.push({ label: '下载并打开', kind: 'download', url: info.downloadUrl })
  }

  actions.push({ label: '在浏览器打开', kind: 'open-url', url: info.releaseUrl })

  return {
    id: `update:${info.version}`,
    kind: 'update',
    title: info.title,
    subtitle: '新版本可用',
    body: info.notes ?? '',
    publishedAt: info.publishedAt ?? undefined,
    actions,
  }
}
