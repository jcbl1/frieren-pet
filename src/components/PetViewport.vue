<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'

import { createRenderer } from '@/renderers/createRenderer'
import type { PetRenderer } from '@/renderers/types'
import type { PetConfig } from '@/types/pet'

const props = defineProps<{
  config: PetConfig | null
  state: string
  src: string
}>()

const hostRef = useTemplateRef<HTMLDivElement>('host')

let renderer: PetRenderer | null = null

function ensureRenderer() {
  const format = props.config?.format

  if (!format) return null

  if (renderer?.format === format) return renderer

  renderer?.destroy()
  renderer = createRenderer(format)

  if (hostRef.value && props.config) {
    renderer.mount(hostRef.value, props.config)
  }

  return renderer
}

function applyState() {
  const renderer = ensureRenderer()

  if (!renderer || !props.config) return

  const stateConfig = props.config.states[props.state]

  if (!stateConfig) return

  renderer.applyState(props.state, stateConfig, props.src, props.config)
}

onMounted(applyState)

watch(
  () => [props.config?.format, props.state, props.src] as const,
  applyState,
)

onBeforeUnmount(() => {
  renderer?.destroy()
  renderer = null
})
</script>

<template>
  <div ref="host" class="pet-viewport" />
</template>

<style scoped>
.pet-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}
</style>
