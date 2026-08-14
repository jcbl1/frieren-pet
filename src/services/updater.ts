import { invoke } from '@tauri-apps/api/core'
import { relaunch } from '@tauri-apps/plugin-process'
import { check as checkPluginUpdate } from '@tauri-apps/plugin-updater'

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

export async function installUpdate(
  onProgress?: (downloaded: number, contentLength: number | undefined) => void,
): Promise<void> {
  if (!isTauri()) {
    throw new Error('浏览器预览模式不支持自动更新')
  }

  const update = await checkPluginUpdate()

  if (!update) {
    throw new Error('未找到可用的更新')
  }

  let downloaded = 0
  let contentLength: number | undefined

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        contentLength = event.data.contentLength

        break
      case 'Progress':
        downloaded += event.data.chunkLength

        onProgress?.(downloaded, contentLength)

        break
    }
  })

  await relaunch()
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

  actions.push({ label: '下载并安装', kind: 'download', url: info.downloadUrl ?? info.releaseUrl })

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
