import { convertFileSrc } from '@tauri-apps/api/core'
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { resolveResource } from '@tauri-apps/api/path'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { availableMonitors } from '@tauri-apps/api/window'
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
  const petStore = usePetStore()
  const appWindow = getCurrentWebviewWindow()
  const scale = petStore.scale / 100

  const target = new PhysicalSize({
    width: Math.round(petConfig.width * scale),
    height: Math.round(petConfig.height * scale),
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
    setState,
    wake,
    resizeWindow,
  }
}
