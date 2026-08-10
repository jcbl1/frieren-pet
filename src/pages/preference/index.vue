<script setup lang="ts">
import { getName, getVersion } from '@tauri-apps/api/app'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onMounted, ref } from 'vue'

import { usePetStore } from '@/stores/pet'

const petStore = usePetStore()

const appName = ref('')
const appVersion = ref('')

onMounted(async () => {
  const [name, version] = await Promise.all([getName(), getVersion()])

  appName.value = name
  appVersion.value = version
})

function close() {
  void getCurrentWebviewWindow().close()
}
</script>

<template>
  <div class="preference-root">
    <header class="topbar">
      <h1 class="title">设置</h1>

      <button class="close" type="button" aria-label="关闭" @click="close">×</button>
    </header>

    <main class="content">
      <section class="group">
        <h2 class="group-title">窗口</h2>

        <div class="row">
          <div class="row-text">
            <span class="row-label">缩放</span>
            <span class="row-desc">20% – 150%</span>
          </div>

          <input
            v-model.number="petStore.scale"
            class="range"
            type="range"
            min="20"
            max="150"
            step="1"
          >

          <span class="value">{{ petStore.scale }}%</span>
        </div>

        <div class="row">
          <div class="row-text">
            <span class="row-label">透明度</span>
            <span class="row-desc">10% – 100%</span>
          </div>

          <input
            v-model.number="petStore.opacity"
            class="range"
            type="range"
            min="10"
            max="100"
            step="1"
          >

          <span class="value">{{ petStore.opacity }}%</span>
        </div>

        <div class="row">
          <div class="row-text">
            <span class="row-label">始终置顶</span>
            <span class="row-desc">宠物窗口保持在其它窗口上方</span>
          </div>

          <button
            class="switch"
            :class="{ on: petStore.alwaysOnTop }"
            type="button"
            role="switch"
            :aria-checked="petStore.alwaysOnTop"
            @click="petStore.alwaysOnTop = !petStore.alwaysOnTop"
          >
            <span class="knob" />
          </button>
        </div>

        <div class="row">
          <div class="row-text">
            <span class="row-label">鼠标穿透</span>
            <span class="row-desc">点击会直接穿过宠物。开启后请通过托盘菜单恢复</span>
          </div>

          <button
            class="switch"
            :class="{ on: petStore.passThrough }"
            type="button"
            role="switch"
            :aria-checked="petStore.passThrough"
            @click="petStore.passThrough = !petStore.passThrough"
          >
            <span class="knob" />
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
    </main>
  </div>
</template>

<style scoped>
.preference-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fafafa;
  color: #2d2d2d;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e6e6e6;
  background: #ffffff;
}

.title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b6b6b;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.close:hover {
  background: #f0f0f0;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.group {
  margin-bottom: 20px;
}

.group-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #8a8a8a;
}

.group:not(:first-child) .group-title {
  margin-top: 20px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid #efefef;
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
  color: #8a8a8a;
}

.value {
  min-width: 44px;
  text-align: right;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: #6b6b6b;
}

.range {
  width: 160px;
  accent-color: #7c9a7c;
}

.switch {
  position: relative;
  width: 42px;
  height: 24px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: #d0d0d0;
  cursor: pointer;
  transition: background 0.15s ease;
}

.switch.on {
  background: #7c9a7c;
}

.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
  transition: transform 0.15s ease;
}

.switch.on .knob {
  transform: translateX(18px);
}

.row.static {
  justify-content: space-between;
}
</style>
