<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { loadPetCatalog } from '@/services/petCatalog'
import type { PetEntry } from '@/services/petCatalog'
import { formatSize, installShopPet, loadShopCatalog } from '@/services/petShop'
import type { ShopItem } from '@/services/petShop'

const items = ref<ShopItem[]>([])
const installedIds = ref(new Set<string>())
const installingId = ref<string | null>(null)
const loading = ref(true)
const status = ref<{ message: string; isError: boolean } | null>(null)

let statusTimer: ReturnType<typeof setTimeout> | undefined

async function loadInstalledIds() {
  let pets: PetEntry[]

  try {
    pets = await loadPetCatalog()
  } catch (error) {
    console.error('[frieren-pet] shop: load local catalog failed:', error)

    return
  }

  installedIds.value = new Set(pets.map((pet) => pet.id))
}

async function load() {
  loading.value = true

  try {
    const catalog = await loadShopCatalog()

    items.value = catalog.items
    await loadInstalledIds()
  } catch (error) {
    setStatus(String(error), true)
  }

  loading.value = false
}

onMounted(load)

onBeforeUnmount(() => {
  if (statusTimer) clearTimeout(statusTimer)
})

function setStatus(message: string, isError = false) {
  status.value = { message, isError }

  if (statusTimer) clearTimeout(statusTimer)

  statusTimer = setTimeout(() => {
    status.value = null
  }, 5000)
}

async function handleInstall(item: ShopItem) {
  if (installingId.value) return

  installingId.value = item.id
  status.value = null

  try {
    await installShopPet(item.downloadUrl)

    await loadInstalledIds()

    setStatus(`已安装角色「${item.name}」，可在「角色」中切换`)
  } catch (error) {
    setStatus(String(error), true)
  }

  installingId.value = null
}
</script>

<template>
  <section class="group">
    <div class="group-head">
      <h2 class="group-title">商店</h2>

      <button class="group-action" type="button" :disabled="loading" @click="load">刷新</button>
    </div>

    <p v-if="status" class="shop-status" :class="{ error: status.isError }">
      {{ status.message }}
    </p>

    <div v-if="loading" class="shop-grid">
      <div class="shop-card shop-card--placeholder">加载中…</div>
    </div>

    <div v-else-if="items.length === 0" class="shop-grid">
      <div class="shop-card shop-card--placeholder">商店暂无角色</div>
    </div>

    <div v-else class="shop-grid">
      <div v-for="item in items" :key="item.id" class="shop-card">
        <div class="shop-head">
          <img class="shop-preview" :src="item.previewUrl" alt="">

          <div class="shop-meta">
            <span class="shop-name">{{ item.name }}</span>
            <span class="shop-version">v{{ item.version }}</span>
          </div>
        </div>

        <p class="shop-desc">{{ item.description }}</p>

        <div class="shop-foot">
          <span class="shop-author">{{ item.author }}</span>

          <span v-if="item.size != null" class="shop-size">{{ formatSize(item.size) }}</span>

          <button
            class="shop-install"
            type="button"
            :disabled="installedIds.has(item.id) || installingId === item.id"
            @click="handleInstall(item)"
          >
            <template v-if="installedIds.has(item.id)">已安装</template>
            <template v-else-if="installingId === item.id">安装中…</template>
            <template v-else>安装</template>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.group-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}

.group-action {
  margin-bottom: 8px;
  padding: 4px 10px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.group-action:hover {
  background: var(--accent);
  color: #ffffff;
}

.group-action:disabled {
  opacity: 0.5;
  cursor: default;
}

.shop-status {
  margin: 0 0 10px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--bg-soft);
  color: var(--accent-text);
  font-size: 12px;
}

.shop-status.error {
  background: var(--bg-danger);
  color: var(--text-danger);
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.shop-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-surface);
}

.shop-card--placeholder {
  justify-content: center;
  align-items: center;
  color: var(--text-muted);
  font-size: 12px;
}

.shop-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shop-preview {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: contain;
  background: var(--bg-sidebar);
}

.shop-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.shop-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.shop-version {
  font-size: 11px;
  color: var(--text-muted);
}

.shop-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.shop-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
}

.shop-author {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-size {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.shop-install {
  flex-shrink: 0;
  padding: 4px 12px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--accent);
  color: #ffffff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.shop-install:hover {
  background: var(--accent-hover);
}

.shop-install:disabled {
  border-color: var(--border);
  background: var(--bg-hover);
  color: var(--text-muted);
  cursor: default;
}
</style>
