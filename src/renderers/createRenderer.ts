import type { PetFormat } from '@/types/pet'

import { GifRenderer } from './gif'
import { Live2DRenderer } from './live2d'
import type { PetRenderer } from './types'

export function createRenderer(format: PetFormat): PetRenderer {
  switch (format) {
    case 'gif':
      return new GifRenderer()
    case 'live2d':
      return new Live2DRenderer()
    default:
      throw new Error(`[frieren-pet] unsupported pet format: ${format}`)
  }
}
