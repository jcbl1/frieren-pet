import type { PetFormat, PetStateConfig } from '@/types/pet'

export interface PetRenderer {
  readonly format: PetFormat
  mount(host: HTMLElement): void
  applyState(state: string, config: PetStateConfig, mediaUrl: string): void
  destroy(): void
}
