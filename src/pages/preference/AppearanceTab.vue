<script setup lang="ts">
import { computed } from 'vue'

import { usePetStore } from '@/stores/pet'
import type { ThemeMode } from '@/stores/pet'

const petStore = usePetStore()

const idleSeconds = computed({
  get: () => (petStore.idleAfterMs == null ? 60 : petStore.idleAfterMs / 1000),
  set: (value) => {
    petStore.idleAfterMs = value * 1000
  },
})

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'auto', label: '自动' },
]
</script>

<template>
  <section class="group">
    <h2 class="group-title">外观</h2>

    <div class="row">
      <div class="row-text">
        <span class="row-label">主题</span>
        <span class="row-desc">自动跟随系统深浅色</span>
      </div>

      <div class="segmented" role="radiogroup">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          class="segment"
          :class="{ active: petStore.theme === option.value }"
          type="button"
          role="radio"
          :aria-checked="petStore.theme === option.value"
          @click="petStore.theme = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  </section>

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
    <h2 class="group-title">闲置</h2>

    <div class="row">
      <div class="row-text">
        <span class="row-label">闲置动画</span>
        <span class="row-desc">无操作一段时间后进入睡眠等闲置状态</span>
      </div>

      <button
        class="switch"
        :class="{ on: petStore.idleEnabled }"
        type="button"
        role="switch"
        :aria-checked="petStore.idleEnabled"
        @click="petStore.idleEnabled = !petStore.idleEnabled"
      >
        <span class="knob" />
      </button>
    </div>

    <div v-if="petStore.idleEnabled" class="row">
      <div class="row-text">
        <span class="row-label">闲置时间</span>
        <span class="row-desc">10 秒 – 600 秒</span>
      </div>

      <input v-model.number="idleSeconds" class="range" type="range" min="10" max="600" step="10">

      <span class="value">{{ idleSeconds }}s</span>
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

.range {
  width: 160px;
  accent-color: var(--accent);
}

.segmented {
  display: flex;
  flex-shrink: 0;
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-hover);
}

.segment {
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.segment:hover {
  color: var(--text-primary);
}

.segment.active {
  background: var(--bg-active);
  color: var(--text-primary);
  box-shadow: 0 1px 2px var(--shadow);
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
