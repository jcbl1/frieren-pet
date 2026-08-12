<script setup lang="ts">
import { computed } from 'vue'

import { usePetStore } from '@/stores/pet'

const petStore = usePetStore()

const idleSeconds = computed({
  get: () => (petStore.idleAfterMs == null ? 60 : petStore.idleAfterMs / 1000),
  set: (value) => {
    petStore.idleAfterMs = value * 1000
  },
})
</script>

<template>
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
</style>
