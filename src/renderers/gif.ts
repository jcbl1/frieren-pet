import type { PetConfig, PetFormat, PetStateConfig } from '@/types/pet'

import type { PetRenderer } from './types'

export class GifRenderer implements PetRenderer {
  readonly format: PetFormat = 'gif'

  private host: HTMLElement | null = null
  private image: HTMLImageElement | null = null

  mount(host: HTMLElement, _config: PetConfig) {
    this.destroy()

    this.host = host

    const image = document.createElement('img')

    image.draggable = false
    image.alt = ''
    image.style.width = '100%'
    image.style.height = '100%'
    image.style.objectFit = 'contain'
    image.style.pointerEvents = 'none'
    image.style.userSelect = 'none'
    image.style.setProperty('-webkit-user-drag', 'none')

    host.appendChild(image)
    this.image = image
  }

  applyState(_state: string, _config: PetStateConfig, mediaUrl: string, _petConfig: PetConfig) {
    if (!this.image) return

    this.image.src = mediaUrl
  }

  destroy() {
    this.image?.remove()
    this.image = null
    this.host = null
  }
}
