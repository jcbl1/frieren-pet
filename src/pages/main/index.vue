<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onMounted } from 'vue'

import { resizeWindow, setState, usePet, wake } from '@/composables/usePet'
import { usePetStore } from '@/stores/pet'

const appWindow = getCurrentWebviewWindow()

const petStore = usePetStore()

const { currentSrc } = usePet()

const DRAG_THRESHOLD = 4

const dragState = {
  active: false,
  tracking: false,
  dragging: false,
  startX: 0,
  startY: 0,
}

onMounted(async () => {
  await setState('sleep')
  await resizeWindow()
  wake()
})

function handleMouseDown(event: MouseEvent) {
  if (event.button !== 0) return

  event.preventDefault()

  dragState.active = true
  dragState.tracking = false
  dragState.dragging = false
  dragState.startX = event.screenX
  dragState.startY = event.screenY
}

function handleMouseMove(event: MouseEvent) {
  const { buttons, shiftKey } = event

  if (buttons === 2 && shiftKey) {
    const delta = (event.movementX + event.movementY) * 0.5

    petStore.scale = Math.max(20, Math.min(petStore.scale + delta, 150))

    return
  }

  if (!dragState.active || dragState.dragging) return

  const dx = event.screenX - dragState.startX
  const dy = event.screenY - dragState.startY

  if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return

  dragState.tracking = true
  dragState.dragging = true

  void appWindow.startDragging()
}

function handleMouseUp() {
  dragState.active = false
}

function handleClick() {
  if (dragState.tracking) {
    dragState.tracking = false

    return
  }

  wake()

  void setState('click')
}
</script>

<template>
  <div
    class="pet-root"
    :style="{ opacity: petStore.opacity / 100 }"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @click="handleClick"
    @mouseenter="wake"
    @contextmenu.prevent
  >
    <img class="pet-image" :src="currentSrc" draggable="false" alt="frieren">
  </div>
</template>

<style scoped>
.pet-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
  -webkit-user-drag: none;
  -webkit-tap-highlight-color: transparent;
}

.pet-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
</style>
