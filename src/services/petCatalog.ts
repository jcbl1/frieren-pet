import { convertFileSrc } from '@tauri-apps/api/core'
import { resolveResource } from '@tauri-apps/api/path'

import { loadPetConfig, loadPresetPetIds } from '@/services/petConfig'
import type { PetConfig } from '@/types/pet'

export interface PetEntry extends PetConfig {
  isPreset: boolean
  previewUrl: string
}

async function resolvePreviewUrl(config: PetConfig) {
  const src = config.preview ?? config.states[config.defaultState]?.src

  if (!src) return ''

  const path = await resolveResource(`${config.resourceDir}/${src}`)

  return convertFileSrc(path)
}

export async function loadPetCatalog(): Promise<PetEntry[]> {
  const presetIds = await loadPresetPetIds()
  const entries: PetEntry[] = []

  for (const id of presetIds) {
    try {
      const config = await loadPetConfig(id)
      const previewUrl = await resolvePreviewUrl(config)

      entries.push({ ...config, isPreset: true, previewUrl })
    } catch (error) {
      console.error(`[frieren-pet] catalog: skip preset "${id}":`, error)
    }
  }

  return entries
}
