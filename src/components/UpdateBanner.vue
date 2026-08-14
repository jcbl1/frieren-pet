<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { usePetStore } from '@/stores/pet'
import { dismissNotice } from '@/services/notice'
import { useNoticeModal } from '@/composables/useNoticeModal'

const ROTATE_INTERVAL = 4000

const petStore = usePetStore()
const { open } = useNoticeModal()

const index = ref(0)
const hovered = ref(false)

const notice = computed(() => petStore.pendingNotices[index.value] ?? null)
const count = computed(() => petStore.pendingNotices.length)

let rotateTimer: number | undefined

function startRotate() {
  if (rotateTimer !== undefined) return

  rotateTimer = window.setInterval(() => {
    if (hovered.value) return
    if (petStore.pendingNotices.length < 2) return

    index.value = (index.value + 1) % petStore.pendingNotices.length
  }, ROTATE_INTERVAL)
}

function stopRotate() {
  if (rotateTimer !== undefined) {
    window.clearInterval(rotateTimer)
    rotateTimer = undefined
  }
}

watch(
  () => petStore.pendingNotices.length,
  (length) => {
    if (length === 0) {
      index.value = 0
      stopRotate()

      return
    }

    if (index.value >= length) {
      index.value = length - 1
    }

    if (length >= 2) {
      startRotate()
    } else {
      stopRotate()
    }
  },
  { immediate: true },
)

onBeforeUnmount(stopRotate)

function handleOpen() {
  const current = notice.value

  if (!current) return

  open(current)
}

function handleDismiss() {
  if (notice.value) dismissNotice(notice.value.id)
}
</script>

<template>
  <Transition name="banner">
    <div
      v-if="notice"
      class="banner"
      role="button"
      tabindex="0"
      @click="handleOpen"
      @keydown.enter="handleOpen"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
    >
      <span class="banner-dot" />

      <div class="banner-content">
        <Transition name="banner-switch" mode="out-in">
          <div :key="notice.id" class="banner-text">
            <span class="banner-title">{{ notice.title }}</span>
            <span v-if="notice.subtitle" class="banner-subtitle">{{ notice.subtitle }}</span>
          </div>
        </Transition>

        <div v-if="count >= 2" class="banner-dots">
          <button
            v-for="(item, itemIndex) in petStore.pendingNotices"
            :key="item.id"
            class="banner-dot-indicator"
            :class="{ active: itemIndex === index }"
            type="button"
            :aria-label="`第 ${itemIndex + 1} 条公告`"
            @click.stop="index = itemIndex"
          />
        </div>
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

.banner-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.banner-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-height: 36px;
  min-width: 0;
}

.banner-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 18px;
}

.banner-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 16px;
}

.banner-dots {
  display: flex;
  gap: 4px;
}

.banner-dot-indicator {
  width: 7px;
  height: 7px;
  padding: 0;
  border: 1px solid var(--text-muted);
  border-radius: 999px;
  background: transparent;
  opacity: 0.6;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.banner-dot-indicator:hover {
  opacity: 1;
}

.banner-dot-indicator.active {
  border-color: var(--accent);
  background: var(--accent);
  opacity: 1;
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

.banner-switch-enter-active,
.banner-switch-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.banner-switch-enter-from {
  opacity: 0;
  transform: translateX(8px);
}

.banner-switch-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}
</style>

