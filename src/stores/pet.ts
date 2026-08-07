import { reactive } from 'vue'

export interface PetStore {
  scale: number
  alwaysOnTop: boolean
  opacity: number
}

export const petStore = reactive<PetStore>({
  scale: 60,
  alwaysOnTop: true,
  opacity: 100,
})
