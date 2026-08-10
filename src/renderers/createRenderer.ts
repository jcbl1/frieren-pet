import type { PetFormat } from '@/types/pet'

import { GifRenderer } from './gif'
import type { PetRenderer } from './types'

export function createRenderer(format: PetFormat): PetRenderer {
  switch (format) {
    case 'gif':
      return new GifRenderer()
    default:
      throw new Error(`[frieren-pet] unsupported pet format: ${format}`)
  }
}
