export type PetFormat = 'gif' | 'live2d'

export interface PetStateConfig {
  src: string
  loop: boolean
  durationMs?: number
  next?: string
}

export interface PetCapability {
  state: string
  cooldownMs?: number
  afterMs?: number
}

export type PetCapabilities = Record<string, string | PetCapability>

export interface PetConfig {
  id: string
  name: string
  format: PetFormat
  resourceDir: string
  width: number
  height: number
  defaultState: string
  version?: string
  preview?: string
  model?: string
  motions?: Record<string, string[]>
  capabilities?: PetCapabilities
  states: Record<string, PetStateConfig>
}
