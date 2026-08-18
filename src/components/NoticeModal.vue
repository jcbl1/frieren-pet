<script setup lang="ts">
import { computed, ref } from 'vue'

import { useNoticeModal } from '@/composables/useNoticeModal'
import { installUpdate, openReleasePage } from '@/services/updater'
import type { NoticeAction } from '@/types/update'

const { visible, current, close } = useNoticeModal()

type DownloadState = 'idle' | 'downloading' | 'done' | 'error'

const downloadState = ref<DownloadState>('idle')
const downloadMessage = ref('')
const downloadPercent = ref(0)

const badge = computed(() => (current.value?.kind === 'update' ? '更新' : '公告'))

const publishedLabel = computed(() => {
  const publishedAt = current.value?.publishedAt

  if (!publishedAt) return ''

  const date = new Date(publishedAt)

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN')
})

async function handleAction(action: NoticeAction) {
  if (action.kind === 'open-url' && action.url) {
    void openReleasePage(action.url)

    return
  }

  if (action.kind === 'download') {
    downloadState.value = 'downloading'
    downloadMessage.value = ''
    downloadPercent.value = 0

    try {
      await installUpdate((downloaded, contentLength) => {
        if (contentLength && contentLength > 0) {
          downloadPercent.value = Math.min(100, Math.round((downloaded / contentLength) * 100))
        }
      })

      downloadState.value = 'done'
      downloadMessage.value = '更新完成，正在重启…'
    } catch (error) {
      downloadState.value = 'error'
      downloadMessage.value = String(error)
      console.error('[frieren-pet] install update failed:', error)
    }
  }
}

function handleClose() {
  close()
  downloadState.value = 'idle'
  downloadMessage.value = ''
  downloadPercent.value = 0
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible && current" class="modal-overlay" @click.self="handleClose">
        <div class="modal" role="dialog" aria-modal="true">
          <header class="modal-header">
            <span class="badge">{{ badge }}</span>
            <h2 class="modal-title">{{ current.title }}</h2>
            <button class="modal-close" type="button" aria-label="关闭" @click="handleClose">×</button>
          </header>

          <p v-if="current.subtitle" class="modal-subtitle">{{ current.subtitle }}</p>
          <p v-if="publishedLabel" class="modal-meta">{{ publishedLabel }}</p>

          <pre class="modal-body">{{ current.body }}</pre>

          <p v-if="downloadMessage" class="modal-feedback">{{ downloadMessage }}</p>

          <p v-if="downloadState === 'downloading' && downloadPercent > 0" class="modal-feedback">
            已下载 {{ downloadPercent }}%
          </p>

          <footer v-if="current.actions?.length" class="modal-footer">
            <button
              v-for="action in current.actions"
              :key="action.label"
              class="modal-action"
              :class="{ primary: action.kind === 'download' }"
              :disabled="action.kind === 'download' && downloadState === 'downloading'"
              type="button"
              @click="handleAction(action)"
            >
              {{ action.kind === 'download' && downloadState === 'downloading' ? `下载中…${downloadPercent > 0 ? ` ${downloadPercent}%` : ''}` : action.label }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(0 0 0 / 0.35);
  z-index: 100;
}

.modal {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 460px;
  max-height: 100%;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-surface);
  box-shadow: 0 8px 24px var(--shadow-strong);
  color: var(--text-primary);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 12px;
  font-weight: 600;
}

.modal-title {
  flex: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  min-width: 0;
}

.modal-close {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.modal-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.modal-meta {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.modal-body {
  flex: 1;
  min-height: 80px;
  max-height: 320px;
  margin: 0;
  padding: 10px 12px;
  overflow: auto;
  border-radius: 8px;
  background: var(--bg);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.modal-feedback {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.modal-action {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.modal-action:hover {
  background: var(--bg-hover);
}

.modal-action.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg-surface);
}

.modal-action.primary:hover {
  background: var(--accent-hover);
}

.modal-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: scale(0.96);
}
</style>
