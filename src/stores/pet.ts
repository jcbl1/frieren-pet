import { defineStore } from 'pinia'

export interface PetStoreState {
  scale: number
  alwaysOnTop: boolean
  opacity: number
  passThrough: boolean
  x: number | null
  y: number | null
}

export const usePetStore = defineStore('pet', {
  state: (): PetStoreState => ({
    scale: 60,
    alwaysOnTop: true,
    opacity: 100,
    passThrough: false,
    x: null,
    y: null,
  }),
})
