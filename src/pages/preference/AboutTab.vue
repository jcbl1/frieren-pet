<script setup lang="ts">
import { getName, getVersion } from '@tauri-apps/api/app'
import { onMounted, ref } from 'vue'

import { useNoticeModal } from '@/composables/useNoticeModal'
import { enqueueNotices } from '@/services/notice'
import { checkForUpdate, updateToNotice } from '@/services/updater'
import { usePetStore } from '@/stores/pet'

const appName = ref('')
const appVersion = ref('')

const checking = ref(false)
const checkMessage = ref('')

const petStore = usePetStore()
const { open } = useNoticeModal()

onMounted(async () => {
  const [name, version] = await Promise.all([getName(), getVersion()])

  appName.value = name
  appVersion.value = version
})

async function handleCheckUpdate() {
  if (checking.value) return

  checking.value = true
  checkMessage.value = ''

  try {
    const info = await checkForUpdate()

    if (info) {
      const notice = updateToNotice(info)

      enqueueNotices([notice], { notify: false })
      open(notice)
    } else {
      checkMessage.value = '当前已是最新版本'
    }
  } catch (error) {
    checkMessage.value = `检查更新失败：${String(error)}`
    console.error('[frieren-pet] check update failed:', error)
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <section class="group">
    <h2 class="group-title">更新</h2>

    <div class="row">
      <div class="row-text">
        <span class="row-label">自动检查更新</span>
        <span class="row-desc">后台检查新版本，发现时通知</span>
      </div>

      <button
        class="switch"
        :class="{ on: petStore.autoCheckUpdates }"
        type="button"
        role="switch"
        :aria-checked="petStore.autoCheckUpdates"
        @click="petStore.autoCheckUpdates = !petStore.autoCheckUpdates"
      >
        <span class="knob" />
      </button>
    </div>

    <div class="row">
      <div class="row-text">
        <span class="row-label">系统推送</span>
        <span class="row-desc">发现新公告/更新时发送系统通知；关闭后仅应用内横幅提醒</span>
      </div>

      <button
        class="switch"
        :class="{ on: petStore.systemNotifications }"
        type="button"
        role="switch"
        :aria-checked="petStore.systemNotifications"
        @click="petStore.systemNotifications = !petStore.systemNotifications"
      >
        <span class="knob" />
      </button>
    </div>

    <div class="row">
      <div class="row-text">
        <span class="row-label">检查更新</span>
        <span class="row-desc">{{ checkMessage || '手动检查最新版本' }}</span>
      </div>

      <button class="button" type="button" :disabled="checking" @click="handleCheckUpdate">
        {{ checking ? '检查中…' : '检查更新' }}
      </button>
    </div>
  </section>

  <section class="group">
    <h2 class="group-title">关于</h2>

    <div class="row static">
      <span class="row-label">应用</span>
      <span class="value">{{ appName }}</span>
    </div>

    <div class="row static">
      <span class="row-label">版本</span>
      <span class="value">{{ appVersion }}</span>
    </div>
  </section>
</template>

<style scoped>
.group-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}

.group:not(:first-child) .group-title {
  margin-top: 20px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--border-soft);
}

.row:last-child {
  border-bottom: none;
}

.row-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.row-label {
  font-size: 14px;
}

.row-desc {
  font-size: 12px;
  color: var(--text-muted);
}

.value {
  min-width: 44px;
  text-align: right;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.row.static {
  justify-content: space-between;
}

.button {
  flex-shrink: 0;
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.button:hover {
  background: var(--bg-hover);
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.switch {
  position: relative;
  width: 42px;
  height: 24px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: var(--border);
  cursor: pointer;
  transition: background 0.15s ease;
}

.switch.on {
  background: var(--accent);
}

.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--bg-surface);
  box-shadow: 0 1px 2px var(--shadow-strong);
  transition: transform 0.15s ease;
}

.switch.on .knob {
  transform: translateX(18px);
}
</style>
