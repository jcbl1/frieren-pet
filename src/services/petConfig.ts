import { convertFileSrc } from '@tauri-apps/api/core'
import { resolveResource } from '@tauri-apps/api/path'

import type { PetConfig } from '@/types/pet'

const SUPPORTED_FORMATS = new Set(['gif'])

async function readJsonFile(path: string): Promise<unknown> {
  const response = await fetch(convertFileSrc(path))
  const text = await response.text()

  return JSON.parse(text) as unknown
}

export async function loadPresetPetIds(): Promise<string[]> {
  const path = await resolveResource('assets/pets/manifest.json')
  const manifest = (await readJsonFile(path)) as { presets?: string[] }

  return manifest.presets ?? []
}

export async function loadPetConfig(id: string): Promise<PetConfig> {
  const resourceDir = `assets/pets/${id}`
  const path = await resolveResource(`${resourceDir}/pet.json`)
  const raw = (await readJsonFile(path)) as Partial<PetConfig>

  const config = {
    resourceDir,
    ...raw,
  } as PetConfig

  if (config.id !== id) {
    throw new Error(`pet "${id}": pet.json id mismatch (got "${config.id}")`)
  }

  if (!SUPPORTED_FORMATS.has(config.format)) {
    throw new Error(`pet "${id}": unsupported format "${String(config.format)}"`)
  }

  if (!config.states || !config.states[config.defaultState]) {
    throw new Error(`pet "${id}": defaultState "${config.defaultState}" not found in states`)
  }

  return config
}
