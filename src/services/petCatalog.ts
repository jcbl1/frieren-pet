import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import { readDir } from '@tauri-apps/plugin-fs'

import {
  getUserPetsRoot,
  loadPresetPetConfig,
  loadPresetPetIds,
  loadUserPetConfig,
} from '@/services/petConfig'
import type { PetConfig } from '@/types/pet'

export interface PetEntry extends PetConfig {
  isPreset: boolean
  previewUrl: string
}

async function resolvePreviewUrl(config: PetConfig) {
  const src =
    config.preview ?? (config.format === 'live2d' ? undefined : config.states[config.defaultState]?.src)

  if (!src) return ''

  const path = await join(config.resourceDir, src)

  return convertFileSrc(path)
}

async function loadUserPets(): Promise<PetEntry[]> {
  const root = await getUserPetsRoot()
  const entries: PetEntry[] = []

  let dirs: string[]

  try {
    const listed = await readDir(root)

    dirs = listed.filter((entry) => entry.isDirectory).map((entry) => entry.name)
  } catch (error) {
    console.error('[frieren-pet] catalog: cannot read user pets dir:', error)

    return entries
  }

  for (const name of dirs) {
    const rootDir = await join(root, name)

    try {
      const config = await loadUserPetConfig(rootDir)
      const previewUrl = await resolvePreviewUrl(config)

      entries.push({ ...config, isPreset: false, previewUrl })
    } catch (error) {
      console.error(`[frieren-pet] catalog: skip user pet "${name}":`, error)
    }
  }

  return entries
}

export async function loadPetCatalog(): Promise<PetEntry[]> {
  const presetIds = await loadPresetPetIds()
  const entries: PetEntry[] = []

  for (const id of presetIds) {
    try {
      const config = await loadPresetPetConfig(id)
      const previewUrl = await resolvePreviewUrl(config)

      entries.push({ ...config, isPreset: true, previewUrl })
    } catch (error) {
      console.error(`[frieren-pet] catalog: skip preset "${id}":`, error)
    }
  }

  const userPets = await loadUserPets()

  return [...entries, ...userPets]
}

export async function importPet(fromPath: string): Promise<PetEntry> {
  const config = (await invoke('import_pet', { fromPath })) as PetConfig
  const previewUrl = await resolvePreviewUrl(config)

  return { ...config, isPreset: false, previewUrl }
}

export async function deletePet(id: string): Promise<void> {
  await invoke('delete_pet', { id })
}
