import { convertFileSrc } from '@tauri-apps/api/core'
import { PhysicalSize } from '@tauri-apps/api/dpi'
import { resolveResource } from '@tauri-apps/api/path'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { computed, ref, watch } from 'vue'

import petConfigRaw from '@/assets/pets/frieren/pet.json'
import { usePetStore } from '@/stores/pet'

export interface PetStateConfig {
  src: string
  loop: boolean
  durationMs?: number
  next?: string
}

export interface PetConfig {
  id: string
  name: string
  resourceDir: string
  width: number
  height: number
  defaultState: string
  states: Record<string, PetStateConfig>
}

const petConfig = petConfigRaw as PetConfig

export type PetState = keyof typeof petConfigRaw.states

const IDLE_SLEEP_DELAY = 60_000

const currentState = ref<PetState>(petConfig.defaultState as PetState)
const currentSrc = ref<string>('')

let idleTimer: ReturnType<typeof setTimeout> | undefined

async function resolveStateSrc(src: string) {
  const path = await resolveResource(`${petConfig.resourceDir}/${src}`)

  return convertFileSrc(path)
}

function scheduleStateTransition(state: PetState) {
  const config = petConfig.states[state]

  if (!config || !config.durationMs) return

  setTimeout(() => {
    if (currentState.value !== state) return

    void setState((config.next ?? petConfig.defaultState) as PetState)
  }, config.durationMs)
}

export async function setState(state: PetState) {
  const config = petConfig.states[state]

  if (!config) return

  currentState.value = state

  currentSrc.value = await resolveStateSrc(config.src)

  scheduleStateTransition(state)
}

function resetIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer)
  }

  idleTimer = setTimeout(() => {
    if (petConfig.states.sleep) {
      void setState('sleep')
    }
  }, IDLE_SLEEP_DELAY)
}

export function wake() {
  resetIdleTimer()
}

export async function resizeWindow() {
  const petStore = usePetStore()
  const scale = petStore.scale / 100

  await getCurrentWebviewWindow().setSize(
    new PhysicalSize({
      width: Math.round(petConfig.width * scale),
      height: Math.round(petConfig.height * scale),
    }),
  )
}

export function usePet() {
  const petStore = usePetStore()
  const appWindow = getCurrentWebviewWindow()

  watch(() => petStore.scale, resizeWindow)

  watch(
    () => petStore.alwaysOnTop,
    (value) => {
      void appWindow.setAlwaysOnTop(value)
    },
    { immediate: true },
  )

  watch(
    () => petStore.passThrough,
    (value) => {
      void appWindow.setIgnoreCursorEvents(value)
    },
    { immediate: true },
  )

  return {
    currentState,
    currentSrc: computed(() => currentSrc.value),
    setState,
    wake,
    resizeWindow,
  }
}
