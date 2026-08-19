import { convertFileSrc } from '@tauri-apps/api/core'
import { join, sep } from '@tauri-apps/api/path'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { Config, CubismSetting, Live2DSprite, Priority } from 'easy-live2d'
import { Application, Ticker } from 'pixi.js'

import { createLogger } from '@/services/logger'
import type { PetConfig, PetFormat, PetStateConfig } from '@/types/pet'

import type { PetRenderer } from './types'

Config.MouseFollow = false
Config.MotionSound = false
const logger = createLogger('live2d')

function syncJoin(...paths: string[]) {
  const separator = sep()

  return paths
    .map((path, index) => {
      if (index === 0) {
        return path.replace(new RegExp(`${separator}+$`), '')
      }

      return path.replace(new RegExp(`^${separator}+|${separator}+$`, 'g'), '')
    })
    .join(separator)
}

interface ModelJson {
  FileReferences?: {
    Motions?: Record<string, unknown[]>
  }
}

export class Live2DRenderer implements PetRenderer {
  readonly format: PetFormat = 'live2d'

  private host: HTMLElement | null = null
  private config: PetConfig | null = null
  private app: Application | null = null
  private sprite: Live2DSprite | null = null
  private modelWidth = 1
  private modelHeight = 1
  private loadPromise: Promise<void> | null = null
  private resizeObserver: ResizeObserver | null = null

  mount(host: HTMLElement, config: PetConfig) {
    this.destroy()

    this.host = host
    this.config = config

    host.replaceChildren()
  }

  applyState(state: string, stateConfig: PetStateConfig, _mediaUrl: string, petConfig: PetConfig) {
    const modelKey = petConfig.model ? `${petConfig.resourceDir}/${petConfig.model}` : ''

    logger.debug('state requested', {
      petId: petConfig.id,
      state,
      group: stateConfig.src,
      model: petConfig.model,
    })

    if (modelKey !== this.loadedModelKey) {
      this.resetModel()
      this.loadedModelKey = modelKey
    }

    this.config = petConfig
    this.pendingState = state

    this.ensureLoaded()
      .then(async () => {
        if (this.pendingState !== state) {
          logger.debug('state request superseded', { state, pendingState: this.pendingState })

          return
        }

        await this.playGroup(stateConfig.src, state)
      })
      .catch((error) => {
        logger.error('state playback failed', { state, group: stateConfig.src, error })
      })
  }

  destroy() {
    this.resetModel()

    this.host = null
    this.config = null
    this.loadedModelKey = ''
    this.pendingState = ''
  }

  private pendingState = ''
  private loadedModelKey = ''

  private resetModel() {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    this.sprite?.destroy()
    this.sprite = null

    void this.app?.destroy(true)
    this.app = null

    if (this.host) {
      this.host.replaceChildren()
    }

    this.loadPromise = null
  }

  private ensureLoaded(): Promise<void> {
    if (this.loadPromise) return this.loadPromise

    this.loadPromise = this.load().catch((error) => {
      logger.error('model load failed', error)
      this.loadPromise = null

      throw error
    })

    return this.loadPromise
  }

  private async load() {
    const config = this.config

    if (!config?.model || !this.host) return

    const modelPath = await join(config.resourceDir, config.model)
    logger.debug('loading model', { petId: config.id, modelPath })

    const raw = await readTextFile(modelPath)
    const modelJson = JSON.parse(raw) as ModelJson

    logger.debug('model motions before injection', {
      groups: Object.keys(modelJson.FileReferences?.Motions ?? {}),
    })

    this.injectMotions(modelJson)

    logger.debug('model motions after injection', {
      groups: Object.fromEntries(
        Object.entries(modelJson.FileReferences?.Motions ?? {}).map(([group, motions]) => [group, motions.length]),
      ),
    })

    const setting = new CubismSetting({ modelJSON: modelJson })

    setting.redirectPath(({ file }) => convertFileSrc(syncJoin(config.resourceDir, file)))

    const app = new Application()

    await app.init({
      backgroundAlpha: 0,
      autoDensity: true,
      antialias: true,
      resolution: Math.max(window.devicePixelRatio || 1, 1),
    })

    app.canvas.style.width = '100%'
    app.canvas.style.height = '100%'
    app.canvas.style.pointerEvents = 'none'

    this.host.appendChild(app.canvas)
    this.app = app

    const sprite = new Live2DSprite({ modelSetting: setting, ticker: Ticker.shared })

    this.sprite = sprite
    app.stage.addChild(sprite)

    await sprite.ready

    this.modelWidth = sprite.width
    this.modelHeight = sprite.height

    logger.info('model ready', {
      petId: config.id,
      modelWidth: this.modelWidth,
      modelHeight: this.modelHeight,
      motions: sprite.getMotions(),
    })

    this.fitModel()

    this.resizeObserver = new ResizeObserver(() => this.fitModel())
    this.resizeObserver.observe(this.host)
  }

  private injectMotions(modelJson: ModelJson) {
    const motions = this.config?.motions

    if (!motions || Object.keys(motions).length === 0) return

    logger.debug('injecting configured motions', { groups: Object.keys(motions) })

    const registered: Record<string, unknown[]> = modelJson.FileReferences?.Motions ?? {}

    for (const [group, files] of Object.entries(motions)) {
      if (!files?.length) continue

      registered[group] = files.map((file) => ({ File: file }))
    }

    if (!modelJson.FileReferences) {
      modelJson.FileReferences = {}
    }

    modelJson.FileReferences.Motions = registered
  }

  private async playGroup(group: string, state: string) {
    const sprite = this.sprite

    if (!sprite) {
      logger.warn('cannot play motion without sprite', { state, group })

      return
    }

    const priority = group === Config.MotionGroupIdle ? Priority.Idle : Priority.Force
    const motions = sprite.getMotions().filter((motion) => motion.group === group)

    logger.debug('playing motion group', {
      state,
      group,
      priority,
      availableMotions: motions,
    })

    if (motions.length === 0) {
      logger.warn('motion group unavailable', { state, group })

      return
    }

    const handle = await sprite.startRandomMotion({ group, priority })

    logger.debug('motion request completed', { state, group, priority, handle })

    if (handle === -1) {
      logger.warn('motion request returned invalid handle', { state, group, priority })
    }
  }

  private fitModel() {
    const { app, sprite, host } = this

    if (!app || !sprite || !host) return

    const width = host.clientWidth
    const height = host.clientHeight

    if (width <= 0 || height <= 0) return

    const scale = Math.min(width / this.modelWidth, height / this.modelHeight)

    sprite.scale.set(scale)
    sprite.x = width / 2
    sprite.y = height / 2
    sprite.anchor.set(0.5)
  }
}
