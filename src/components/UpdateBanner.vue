<script setup lang="ts">
import { computed } from 'vue'

import { usePetStore } from '@/stores/pet'
import { dismissNotice, isNoticeDismissed } from '@/services/notice'
import { useNoticeModal } from '@/composables/useNoticeModal'

const petStore = usePetStore()
const { open } = useNoticeModal()

const notice = computed(() => {
  const pending = petStore.pendingNotice

  if (!pending) return null

  return isNoticeDismissed(pending.id) ? null : pending
})

function handleOpen() {
  if (notice.value) open(notice.value)
}

function handleDismiss() {
  if (notice.value) dismissNotice(notice.value.id)
}
</script>

<template>
  <Transition name="banner">
    <div v-if="notice" class="banner" role="button" tabindex="0" @click="handleOpen" @keydown.enter="handleOpen">
      <span class="banner-dot" />
      <div class="banner-text">
        <span class="banner-title">{{ notice.title }}</span>
        <span v-if="notice.subtitle" class="banner-subtitle">{{ notice.subtitle }}</span>
      </div>
      <button class="banner-close" type="button" aria-label="关闭" @click.stop="handleDismiss">×</button>
    </div>
  </Transition>
</template>

<style scoped>
.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-surface);
  box-shadow: 0 2px 8px var(--shadow);
  cursor: pointer;
  transition: background 0.15s ease;
}

.banner:hover {
  background: var(--bg-hover);
}

.banner-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--accent);
}

.banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.banner-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.banner-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.banner-close {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.banner-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.banner-enter-active,
.banner-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
