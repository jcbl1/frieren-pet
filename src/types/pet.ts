export type PetFormat = 'gif'

export interface PetStateConfig {
  src: string
  loop: boolean
  durationMs?: number
  next?: string
}

export type PetCapabilities = Record<string, string>

export interface PetConfig {
  id: string
  name: string
  format: PetFormat
  resourceDir: string
  width: number
  height: number
  defaultState: string
  preview?: string
  capabilities?: PetCapabilities
  states: Record<string, PetStateConfig>
}
