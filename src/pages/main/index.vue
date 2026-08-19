<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onMounted } from 'vue'

import {
  invoke,
  resizeWindow,
  saveCurrentPosition,
  setDragActive,
  start,
  usePet,
  wake,
} from '@/composables/usePet'
import PetViewport from '@/components/PetViewport.vue'
import { createLogger } from '@/services/logger'
import { usePetStore } from '@/stores/pet'

const appWindow = getCurrentWebviewWindow()

const petStore = usePetStore()
const logger = createLogger('main')

const { config, currentState, currentSrc } = usePet()

const DRAG_THRESHOLD = 4

const dragState = {
  active: false,
  tracking: false,
  dragging: false,
  startX: 0,
  startY: 0,
}

onMounted(async () => {
  await petStore.$tauri.start()

  try {
    await start()
    await resizeWindow()
  } catch (error) {
    logger.error('pet init failed', error)
  }

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

  setDragActive(true)
  void invoke('dragStart')
  void appWindow.startDragging()
}

function handleMouseUp() {
  if (dragState.dragging) {
    saveCurrentPosition()

    setDragActive(false)
    void invoke('dragEnd')
  }

  dragState.active = false
  dragState.dragging = false
}

function handleClick() {
  if (dragState.tracking) {
    dragState.tracking = false

    return
  }

  wake()

  void invoke('click')
}

function handleDoubleClick() {
  wake()

  void invoke('doubleClick')
}

function handleMouseEnter() {
  wake()

  void invoke('mouseEnter')
}

function handleMouseLeave() {
  void invoke('mouseLeave')
}

function handleContextMenu(event: MouseEvent) {
  event.preventDefault()

  if (event.shiftKey) return

  wake()

  void invoke('rightClick')
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
    @dblclick="handleDoubleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @contextmenu="handleContextMenu"
  >
    <PetViewport :config="config" :state="currentState" :src="currentSrc" />
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
</style>
