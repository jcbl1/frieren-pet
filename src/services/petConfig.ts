import { convertFileSrc } from '@tauri-apps/api/core'
import { appDataDir, join, resolveResource } from '@tauri-apps/api/path'

import type { PetConfig } from '@/types/pet'

const SUPPORTED_FORMATS = new Set(['gif', 'live2d'])
const USER_PETS_DIR = 'pets'

export async function getUserPetsRoot(): Promise<string> {
  return join(await appDataDir(), USER_PETS_DIR)
}

export async function readJsonFile(path: string): Promise<unknown> {
  const response = await fetch(convertFileSrc(path))

  if (!response.ok) {
    throw new Error(`读取 ${path} 失败（HTTP ${response.status}）`)
  }

  const text = await response.text()

  return JSON.parse(text) as unknown
}

const PET_ID_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/i

export function validatePetConfig(raw: Partial<PetConfig>, rootDir: string, expectedId?: string): PetConfig {
  const config = {
    ...raw,
    resourceDir: rootDir,
  } as PetConfig

  if (expectedId && config.id !== expectedId) {
    throw new Error(`pet "${expectedId}": pet.json id 不匹配（实际 "${config.id}"）`)
  }

  if (!config.id) {
    throw new Error('pet.json 缺少 id')
  }

  if (!PET_ID_REGEX.test(config.id)) {
    throw new Error(`pet "${config.id}": id 不合法（需以字母或数字开头，仅含字母/数字/_-）`)
  }

  if (!config.name?.trim()) {
    throw new Error(`pet "${config.id}": 缺少 name`)
  }

  if (!SUPPORTED_FORMATS.has(config.format)) {
    throw new Error(`pet "${config.id}": 不支持的格式 "${String(config.format)}"`)
  }

  if (config.format === 'live2d') {
    if (!config.model?.trim()) {
      throw new Error(`pet "${config.id}": live2d 格式缺少 model`)
    }

    if (config.motions != null && typeof config.motions !== 'object') {
      throw new Error(`pet "${config.id}": motions 必须是一个对象`)
    }

    for (const [group, files] of Object.entries(config.motions ?? {})) {
      if (!Array.isArray(files) || files.some((file) => !file?.trim())) {
        throw new Error(`pet "${config.id}": motions[${group}] 必须是非空字符串数组`)
      }
    }
  }

  const hasWidth = config.width != null
  const hasHeight = config.height != null

  if (hasWidth !== hasHeight) {
    throw new Error(`pet "${config.id}": width 和 height 必须同时提供`)
  }

  if (config.ratio != null && (!Number.isFinite(config.ratio) || config.ratio <= 0)) {
    throw new Error(`pet "${config.id}": ratio 必须大于 0`)
  }

  if (config.ratio == null && (!hasWidth || !hasHeight)) {
    throw new Error(`pet "${config.id}": 必须提供 ratio，或同时提供 width/height`)
  }

  if (
    config.ratio == null &&
    (!Number.isFinite(config.width) || config.width! <= 0 || !Number.isFinite(config.height) || config.height! <= 0)
  ) {
    throw new Error(`pet "${config.id}": width/height 必须大于 0`)
  }

  if (config.scale != null && (!Number.isFinite(config.scale) || config.scale <= 0)) {
    throw new Error(`pet "${config.id}": scale 必须大于 0`)
  }

  if (!config.states || Object.keys(config.states).length === 0) {
    throw new Error(`pet "${config.id}": 缺少 states`)
  }

  if (!config.states[config.defaultState]) {
    throw new Error(`pet "${config.id}": defaultState "${config.defaultState}" 不在 states 中`)
  }

  for (const [stateName, state] of Object.entries(config.states)) {
    if (!state?.src?.trim()) {
      throw new Error(`pet "${config.id}": state "${stateName}" 缺少 src`)
    }

    if (state.next && !config.states[state.next]) {
      throw new Error(`pet "${config.id}": state "${stateName}" 的 next "${state.next}" 不存在`)
    }
  }

  for (const [cap, target] of Object.entries(config.capabilities ?? {})) {
    const stateName = typeof target === 'string' ? target : target?.state

    if (!stateName || !config.states[stateName]) {
      throw new Error(`pet "${config.id}": capabilities[${cap}] 指向的状态 "${String(stateName)}" 不存在`)
    }

    if (typeof target === 'object') {
      if (target.cooldownMs != null && (!Number.isFinite(target.cooldownMs) || target.cooldownMs < 0)) {
        throw new Error(`pet "${config.id}": capabilities[${cap}] 的 cooldownMs 不合法`)
      }

      if (target.afterMs != null && (!Number.isFinite(target.afterMs) || target.afterMs <= 0)) {
        throw new Error(`pet "${config.id}": capabilities[${cap}] 的 afterMs 不合法`)
      }
    }
  }

  return config
}

export async function readPetIdFromDir(rootDir: string): Promise<string> {
  const path = await join(rootDir, 'pet.json')
  const raw = (await readJsonFile(path)) as { id?: string }

  if (!raw.id) {
    throw new Error('pet.json 缺少 id')
  }

  return raw.id
}

export async function loadPresetPetIds(): Promise<string[]> {
  const path = await resolveResource('assets/pets/manifest.json')
  const manifest = (await readJsonFile(path)) as { presets?: string[] }

  return manifest.presets ?? []
}

export async function loadPresetPetConfig(id: string): Promise<PetConfig> {
  const rootDir = await resolveResource(`assets/pets/${id}`)
  const path = await join(rootDir, 'pet.json')
  const raw = (await readJsonFile(path)) as Partial<PetConfig>

  return validatePetConfig(raw, rootDir, id)
}

export async function loadUserPetConfig(rootDir: string): Promise<PetConfig> {
  const path = await join(rootDir, 'pet.json')
  const raw = (await readJsonFile(path)) as Partial<PetConfig>

  return validatePetConfig(raw, rootDir)
}

export async function loadPetConfigById(id: string): Promise<PetConfig> {
  const presetIds = await loadPresetPetIds()

  if (presetIds.includes(id)) {
    return loadPresetPetConfig(id)
  }

  const rootDir = await join(await getUserPetsRoot(), id)

  return loadUserPetConfig(rootDir)
}
