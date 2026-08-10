import { convertFileSrc } from '@tauri-apps/api/core'
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { resolveResource } from '@tauri-apps/api/path'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { availableMonitors } from '@tauri-apps/api/window'
import { computed, ref, watch } from 'vue'

import { loadPetConfig, loadPresetPetIds } from '@/services/petConfig'
import { usePetStore } from '@/stores/pet'
import type { PetConfig } from '@/types/pet'

export type PetState = string

const IDLE_SLEEP_DELAY = 60_000
const DEFAULT_PET_ID = 'frieren'

let petConfig: PetConfig | null = null
let petConfigPromise: Promise<PetConfig> | null = null

const currentState = ref<PetState>('')
const currentSrc = ref<string>('')

let idleTimer: ReturnType<typeof setTimeout> | undefined

function getCurrentPetId() {
  const petStore = usePetStore()

  return petStore.currentPetId ?? DEFAULT_PET_ID
}

async function loadDefaultPetConfig() {
  const presetIds = await loadPresetPetIds()
  const id = presetIds[0] ?? DEFAULT_PET_ID
  const petStore = usePetStore()

  if (petStore.currentPetId !== id) petStore.currentPetId = id

  return loadPetConfig(id)
}

function ensurePetConfig(): Promise<PetConfig> {
  const id = getCurrentPetId()

  if (petConfig?.id === id) return Promise.resolve(petConfig)

  if (petConfigPromise) return petConfigPromise

  petConfig = null
  petConfigPromise = loadPetConfig(id)
    .catch((error) => {
      console.error(`[frieren-pet] load pet "${id}" failed:`, error)

      return loadDefaultPetConfig()
    })
    .then((config) => {
      petConfig = config
      petConfigPromise = null

      return config
    })

  return petConfigPromise
}

async function resolveStateSrc(src: string) {
  const config = await ensurePetConfig()
  const path = await resolveResource(`${config.resourceDir}/${src}`)

  return convertFileSrc(path)
}

async function scheduleStateTransition(state: PetState) {
  const config = await ensurePetConfig()
  const stateConfig = config.states[state]

  if (!stateConfig || !stateConfig.durationMs) return

  setTimeout(() => {
    if (currentState.value !== state) return

    void setState((stateConfig.next ?? config.defaultState) as PetState)
  }, stateConfig.durationMs)
}

async function setState(state: PetState) {
  const config = await ensurePetConfig()
  const stateConfig = config.states[state]

  if (!stateConfig) return

  currentState.value = state

  currentSrc.value = await resolveStateSrc(stateConfig.src)

  await scheduleStateTransition(state)
}

export async function start() {
  const config = await ensurePetConfig()

  await setState(config.defaultState)
}

let reloading = false

export async function reloadPet() {
  if (reloading) return

  reloading = true

  try {
    petConfig = null
    petConfigPromise = null

    const config = await ensurePetConfig()

    await setState(config.defaultState)
    await resizeWindow()
    wake()
  } finally {
    reloading = false
  }
}

export async function invoke(cap: string) {
  const config = await ensurePetConfig()
  const state = config.capabilities?.[cap]

  if (!state || !config.states[state]) return

  await setState(state)
}

function resetIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer)
  }

  idleTimer = setTimeout(() => {
    void invoke('idle')
  }, IDLE_SLEEP_DELAY)
}

export function wake() {
  resetIdleTimer()
}

let positionRestored = false
let initialized = false
let resizing = false
let center: { x: number; y: number } | null = null
let pollTimer: ReturnType<typeof setInterval> | undefined

export function saveCurrentPosition() {
  const appWindow = getCurrentWebviewWindow()

  void appWindow.outerPosition().then((position) => {
    const petStore = usePetStore()

    petStore.x = position.x
    petStore.y = position.y
  })
}

async function pollWindowFrame() {
  if (!initialized || resizing) return

  const petStore = usePetStore()
  const appWindow = getCurrentWebviewWindow()

  const [position, size] = await Promise.all([appWindow.outerPosition(), appWindow.outerSize()])

  center = {
    x: position.x + size.width / 2,
    y: position.y + size.height / 2,
  }

  if (petStore.x !== position.x || petStore.y !== position.y) {
    petStore.x = position.x
    petStore.y = position.y
  }
}

async function isPositionOnScreen(x: number, y: number) {
  try {
    const monitors = await availableMonitors()

    if (monitors.length === 0) return true

    return monitors.some((monitor) => {
      const { position, size } = monitor

      return (
        x >= position.x &&
        x < position.x + size.width &&
        y >= position.y &&
        y < position.y + size.height
      )
    })
  } catch (error) {
    console.error('[frieren-pet] monitor check failed:', error)

    return true
  }
}

async function doResize() {
  const config = await ensurePetConfig()
  const petStore = usePetStore()
  const appWindow = getCurrentWebviewWindow()
  const scale = petStore.scale / 100

  const target = new PhysicalSize({
    width: Math.round(config.width * scale),
    height: Math.round(config.height * scale),
  })

  const savedX = petStore.x
  const savedY = petStore.y

  if (!positionRestored && savedX != null && savedY != null) {
    const onScreen = await isPositionOnScreen(savedX, savedY)

    positionRestored = true
    resizing = true

    try {
      await appWindow.setSize(target)

      if (onScreen) {
        await appWindow.setPosition(new PhysicalPosition({ x: savedX, y: savedY }))

        center = {
          x: savedX + target.width / 2,
          y: savedY + target.height / 2,
        }
      } else {
        center = null
      }
    } finally {
      resizing = false
    }

    initialized = true

    return
  }

  if (center == null) {
    const [position, size] = await Promise.all([appWindow.outerPosition(), appWindow.outerSize()])

    center = {
      x: position.x + size.width / 2,
      y: position.y + size.height / 2,
    }
  }

  resizing = true

  try {
    await appWindow.setSize(target)

    await appWindow.setPosition(
      new PhysicalPosition({
        x: Math.round(center.x - target.width / 2),
        y: Math.round(center.y - target.height / 2),
      }),
    )
  } finally {
    resizing = false
  }

  initialized = true
}

let resizeRunning = false
let resizePending = false

export async function resizeWindow() {
  if (resizeRunning) {
    resizePending = true

    return
  }

  resizeRunning = true

  do {
    resizePending = false

    await doResize()
  } while (resizePending)

  resizeRunning = false
}

export function usePet() {
  const petStore = usePetStore()
  const appWindow = getCurrentWebviewWindow()

  watch(
    () => petStore.currentPetId,
    (id) => {
      if (!id) return

      void reloadPet()
    },
  )

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

  if (!pollTimer) {
    pollTimer = setInterval(() => {
      void pollWindowFrame()
    }, 400)
  }

  void appWindow.onCloseRequested(() => {
    saveCurrentPosition()
  })

  return {
    currentState,
    currentSrc: computed(() => currentSrc.value),
    start,
    reloadPet,
    invoke,
    wake,
    resizeWindow,
  }
}
