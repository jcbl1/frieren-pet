import { watch } from 'vue'

import type { ThemeMode } from '@/stores/pet'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemIsDark() {
  return window.matchMedia(DARK_QUERY).matches
}

function resolveTheme(mode: ThemeMode) {
  return mode === 'auto' ? (systemIsDark() ? 'dark' : 'light') : mode
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = resolveTheme(mode)
}

export function useTheme(mode: () => ThemeMode) {
  const media = window.matchMedia(DARK_QUERY)

  const onMediaChange = () => applyTheme(mode())

  media.addEventListener('change', onMediaChange)

  applyTheme(mode())

  watch(mode, applyTheme)

  return () => {
    media.removeEventListener('change', onMediaChange)
  }
}
