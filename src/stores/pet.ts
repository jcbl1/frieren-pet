import { defineStore } from 'pinia'

export interface PetStoreState {
  currentPetId: string | null
  scale: number
  alwaysOnTop: boolean
  opacity: number
  passThrough: boolean
  idleEnabled: boolean
  idleAfterMs: number | null
  x: number | null
  y: number | null
}

export const usePetStore = defineStore('pet', {
  state: (): PetStoreState => ({
    currentPetId: 'frieren',
    scale: 60,
    alwaysOnTop: true,
    opacity: 100,
    passThrough: false,
    idleEnabled: true,
    idleAfterMs: null,
    x: null,
    y: null,
  }),
})
