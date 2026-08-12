import { convertFileSrc } from '@tauri-apps/api/core'
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { join } from '@tauri-apps/api/path'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { availableMonitors, currentMonitor } from '@tauri-apps/api/window'
import { computed, ref, watch } from 'vue'

import { loadPetConfigById, loadPresetPetConfig, loadPresetPetIds } from '@/services/petConfig'
import { usePetStore } from '@/stores/pet'
import type { PetConfig } from '@/types/pet'

export type PetState = string

const IDLE_SLEEP_DELAY = 60_000
const DEFAULT_PET_ID = 'frieren'
const BASE_SCREEN_RATIO = 0.25
const MIN_DIM = 32
const FALLBACK_DIM = 512

let petConfigPromise: Promise<PetConfig> | null = null

const currentState = ref<PetState>('')
const currentSrc = ref<string>('')
const petConfigRef = ref<PetConfig | null>(null)

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

  return loadPresetPetConfig(id)
}

function ensurePetConfig(): Promise<PetConfig> {
  const id = getCurrentPetId()
  const current = petConfigRef.value

  if (current?.id === id) return Promise.resolve(current)

  if (petConfigPromise) return petConfigPromise

  petConfigRef.value = null
  petConfigPromise = loadPetConfigById(id)
    .catch((error) => {
      console.error(`[frieren-pet] load pet "${id}" failed:`, error)

      return loadDefaultPetConfig()
    })
    .then((config) => {
      petConfigRef.value = config
      petConfigPromise = null

      return config
    })

  return petConfigPromise
}

async function resolveStateSrc(src: string) {
  const config = await ensurePetConfig()
  const path = await join(config.resourceDir, src)

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
let pendingReload = false

export async function reloadPet() {
  if (reloading) {
    pendingReload = true

    return
  }

  reloading = true

  try {
    do {
      pendingReload = false

      petConfigRef.value = null
      petConfigPromise = null
      capabilityCooldowns.clear()

      const config = await ensurePetConfig()

      await setState(config.defaultState)
      await resizeWindow()
      wake()
    } while (pendingReload)
  } finally {
    reloading = false
  }
}

export async function invoke(cap: string) {
  const config = await ensurePetConfig()
  const target = config.capabilities?.[cap]

  if (!target) return

  const state = typeof target === 'string' ? target : target.state

  if (!config.states[state]) return

  if (typeof target === 'object' && target.cooldownMs) {
    const until = capabilityCooldowns.get(cap)

    if (until != null && Date.now() < until) return

    capabilityCooldowns.set(cap, Date.now() + target.cooldownMs)
  }

  await setState(state)
}

const capabilityCooldowns = new Map<string, number>()

let dragActive = false

async function resetIdleTimer() {
  const petStore = usePetStore()

  if (idleTimer) {
    clearTimeout(idleTimer)
  }

  if (!petStore.idleEnabled) return

  const config = await ensurePetConfig()
  const idleTarget = config.capabilities?.['idle']
  const afterMs =
    petStore.idleAfterMs ??
    (idleTarget && typeof idleTarget === 'object' && idleTarget.afterMs
      ? idleTarget.afterMs
      : IDLE_SLEEP_DELAY)

  idleTimer = setTimeout(() => {
    if (dragActive) {
      void resetIdleTimer()

      return
    }

    void invoke('idle')
  }, afterMs)
}

export function setDragActive(active: boolean) {
  dragActive = active

  if (active) {
    if (idleTimer) {
      clearTimeout(idleTimer)

      idleTimer = undefined
    }

    return
  }

  void resetIdleTimer()
}

export function wake() {
  dragActive = false

  void resetIdleTimer()
}

let positionRestored = false
let initialized = false
let resizing = false
let center: { x: number; y: number } | null = null
let pollTimer: ReturnType<typeof setInterval> | undefined
let lastScreenShortEdge: number | null = null

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

  const monitor = await currentMonitor()
  const shortEdge = monitor ? Math.min(monitor.size.width, monitor.size.height) : 0

  if (shortEdge > 0 && lastScreenShortEdge != null && shortEdge !== lastScreenShortEdge) {
    void resizeWindow()
  }

  lastScreenShortEdge = shortEdge
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

async function resolveTargetSize(config: PetConfig) {
  const petStore = usePetStore()
  const scale = petStore.scale / 100
  const monitor = await currentMonitor()
  const shortEdge = monitor ? Math.min(monitor.size.width, monitor.size.height) : 0
  const base = shortEdge > 0 ? shortEdge * BASE_SCREEN_RATIO : FALLBACK_DIM
  const aspect = config.height > 0 ? config.width / config.height : 1
  const maxW = monitor?.size.width ?? Number.POSITIVE_INFINITY
  const maxH = monitor?.size.height ?? Number.POSITIVE_INFINITY

  return new PhysicalSize({
    width: Math.max(MIN_DIM, Math.min(Math.round(base * scale * aspect), maxW)),
    height: Math.max(MIN_DIM, Math.min(Math.round(base * scale), maxH)),
  })
}

async function doResize() {
  const config = await ensurePetConfig()
  const petStore = usePetStore()
  const appWindow = getCurrentWebviewWindow()

  const target = await resolveTargetSize(config)

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
    () => [petStore.idleEnabled, petStore.idleAfterMs] as const,
    async ([idleEnabled]) => {
      if (!idleEnabled) {
        const config = await ensurePetConfig()
        const idleTarget = config.capabilities?.['idle']
        const idleState = typeof idleTarget === 'string' ? idleTarget : idleTarget?.state

        if (idleState && currentState.value === idleState) {
          await setState(config.defaultState)
        }
      }

      void wake()
    },
  )

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
    config: computed(() => petConfigRef.value),
    currentState,
    currentSrc: computed(() => currentSrc.value),
    start,
    reloadPet,
    invoke,
    wake,
    setDragActive,
    resizeWindow,
  }
}
