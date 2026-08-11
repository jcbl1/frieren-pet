import { convertFileSrc } from '@tauri-apps/api/core'
import { appDataDir, join, resolveResource } from '@tauri-apps/api/path'

import type { PetConfig } from '@/types/pet'

const SUPPORTED_FORMATS = new Set(['gif'])
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

  if (!config.width || !config.height) {
    throw new Error(`pet "${config.id}": width/height 必须大于 0`)
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

  for (const [cap, stateName] of Object.entries(config.capabilities ?? {})) {
    if (!config.states[stateName]) {
      throw new Error(`pet "${config.id}": capabilities[${cap}] 指向的状态 "${stateName}" 不存在`)
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
