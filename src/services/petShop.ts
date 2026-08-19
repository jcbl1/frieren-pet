import { invoke } from '@tauri-apps/api/core'

import { createLogger } from '@/services/logger'
import type { PetConfig } from '@/types/pet'

const logger = createLogger('shop')

export interface ShopItem {
  id: string
  name: string
  description: string
  author: string
  version: string
  size?: number
  previewUrl: string
  downloadUrl: string
  tags?: string[]
}

export interface ShopCatalog {
  items: ShopItem[]
}

export const SHOP_API_BASE =
  import.meta.env.VITE_SHOP_API_BASE ?? 'https://shop.example.com'

function isTauri() {
  return '__TAURI_INTERNALS__' in window
}

const MOCK_CATALOG: ShopCatalog = {
  items: [
    {
      id: 'fern',
      name: 'Fern',
      description: 'Frieren 的弟子，认真可靠的小魔法使',
      author: 'frieren-pet',
      version: '1.0.0',
      size: 2_048_000,
      previewUrl: 'https://via.placeholder.com/128',
      downloadUrl: 'https://shop.example.com/pets/fern.zip',
      tags: ['anime', 'gif'],
    },
    {
      id: 'stark',
      name: 'Stark',
      description: '怕寂寞的战士，能扛能打',
      author: 'frieren-pet',
      version: '1.0.0',
      size: 1_536_000,
      previewUrl: 'https://via.placeholder.com/128',
      downloadUrl: 'https://shop.example.com/pets/stark.zip',
      tags: ['anime', 'gif'],
    },
    {
      id: 'aureole',
      name: 'Aureole',
      description: '会在头顶聚成光环的鸽子桌宠',
      author: 'community',
      version: '0.9.0',
      size: 890_000,
      previewUrl: 'https://via.placeholder.com/128',
      downloadUrl: 'https://shop.example.com/pets/aureole.zip',
      tags: ['bird', 'gif'],
    },
    {
      id: 'mimic',
      name: 'Mimic',
      description: '伪装成宝箱的怪物，点击会咬人',
      author: 'community',
      version: '1.2.0',
      size: 3_120_000,
      previewUrl: 'https://via.placeholder.com/128',
      downloadUrl: 'https://shop.example.com/pets/mimic.zip',
      tags: ['monster', 'gif'],
    },
    {
      id: 'cat-ghost',
      name: 'Cat Ghost',
      description: '半透明的小猫幽灵，喜欢漂浮',
      author: 'community',
      version: '0.5.0',
      size: 640_000,
      previewUrl: 'https://via.placeholder.com/128',
      downloadUrl: 'https://shop.example.com/pets/cat-ghost.zip',
      tags: ['cat', 'gif'],
    },
    {
      id: 'robot-friend',
      name: 'Robot Friend',
      description: '会眨眼的迷你机器人，陪你写代码',
      author: 'community',
      version: '1.0.0',
      size: 1_280_000,
      previewUrl: 'https://via.placeholder.com/128',
      downloadUrl: 'https://shop.example.com/pets/robot-friend.zip',
      tags: ['robot', 'gif'],
    },
  ],
}

async function fetchCatalogFromServer(): Promise<ShopCatalog> {
  const catalog = (await invoke('fetch_shop_catalog', { baseUrl: SHOP_API_BASE })) as ShopCatalog

  return catalog
}

export async function loadShopCatalog(): Promise<ShopCatalog> {
  if (isTauri()) {
    try {
      return await fetchCatalogFromServer()
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.warn('fetch catalog failed, fall back to mock', error)
      } else {
        throw error
      }
    }
  }

  return MOCK_CATALOG
}

export async function installShopPet(url: string): Promise<PetConfig> {
  if (!isTauri()) {
    throw new Error('浏览器预览模式不支持安装，请通过 pnpm tauri dev 运行')
  }

  return (await invoke('install_pet_from_url', { url })) as PetConfig
}

export function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`

  return `${bytes} B`
}
