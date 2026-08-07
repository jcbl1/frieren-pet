export const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

export const MODIFIER_KEY = isMac ? 'Command' : 'Control'
