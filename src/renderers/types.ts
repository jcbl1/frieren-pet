import type { PetConfig, PetFormat, PetStateConfig } from '@/types/pet'

export interface PetRenderer {
  readonly format: PetFormat
  mount(host: HTMLElement, config: PetConfig): void
  applyState(state: string, config: PetStateConfig, mediaUrl: string, petConfig: PetConfig): void
  destroy(): void
}
