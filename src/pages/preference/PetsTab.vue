<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog'
import { onMounted, onBeforeUnmount, ref } from 'vue'

import { deletePet, importPet, loadPetCatalog } from '@/services/petCatalog'
import { createLogger } from '@/services/logger'
import type { PetEntry } from '@/services/petCatalog'
import { readPetIdFromDir } from '@/services/petConfig'
import { usePetStore } from '@/stores/pet'

const petStore = usePetStore()
const logger = createLogger('pets-tab')

const pets = ref<PetEntry[]>([])
const petLoading = ref(true)
const petStatus = ref<{ message: string; isError: boolean } | null>(null)

let statusTimer: ReturnType<typeof setTimeout> | undefined

onMounted(async () => {
  try {
    pets.value = await loadPetCatalog()
  } catch (error) {
    logger.error('load pet catalog failed', error)
  }

  petLoading.value = false
})

onBeforeUnmount(() => {
  if (statusTimer) clearTimeout(statusTimer)
})

function selectPet(id: string) {
  petStore.currentPetId = id
}

function setStatus(message: string, isError = false) {
  petStatus.value = { message, isError }

  if (statusTimer) clearTimeout(statusTimer)

  statusTimer = setTimeout(() => {
    petStatus.value = null
  }, 5000)
}

async function handleImport() {
  const selected = await open({ directory: true, multiple: false })

  if (!selected) return

  const path = Array.isArray(selected) ? selected[0] : selected

  try {
    const id = await readPetIdFromDir(path)

    if (pets.value.some((pet) => pet.id === id && !pet.isPreset)) {
      if (!window.confirm(`已存在同 id 的用户角色「${id}」，导入将覆盖它。继续？`)) return
    }

    const entry = await importPet(path)

    if (pets.value.some((pet) => pet.id === entry.id)) {
      pets.value = pets.value.map((pet) => (pet.id === entry.id ? entry : pet))
    } else {
      pets.value = [...pets.value, entry]
    }

    petStore.currentPetId = entry.id

    setStatus(`已导入角色「${entry.name}」`)
  } catch (error) {
    setStatus(String(error), true)
  }
}

async function handleDelete(pet: PetEntry) {
  if (!window.confirm(`确定删除角色「${pet.name}」？此操作不可恢复。`)) return

  try {
    await deletePet(pet.id)

    pets.value = pets.value.filter((item) => item.id !== pet.id)

    if (petStore.currentPetId === pet.id) {
      petStore.currentPetId = pets.value[0]?.id ?? null
    }

    setStatus(`已删除角色「${pet.name}」`)
  } catch (error) {
    setStatus(String(error), true)
  }
}
</script>

<template>
  <section class="group">
    <div class="group-head">
      <h2 class="group-title">角色</h2>

      <button class="group-action" type="button" @click="handleImport">导入角色</button>
    </div>

    <p v-if="petStatus" class="pet-status" :class="{ error: petStatus.isError }">
      {{ petStatus.message }}
    </p>

    <div v-if="petLoading" class="pet-grid">
      <div class="pet-card pet-card--placeholder">加载中…</div>
    </div>

    <div v-else class="pet-grid">
      <div
        v-for="pet in pets"
        :key="pet.id"
        class="pet-card"
        :class="{ active: petStore.currentPetId === pet.id }"
        role="button"
        tabindex="0"
        @click="selectPet(pet.id)"
        @keydown.enter="selectPet(pet.id)"
      >
        <img v-if="pet.previewUrl" class="pet-preview" :src="pet.previewUrl" alt="">

        <span class="pet-name">{{ pet.name }}</span>

        <span v-if="!pet.isPreset" class="pet-badge">导入</span>

        <button
          v-if="!pet.isPreset"
          class="pet-delete"
          type="button"
          @click.stop="handleDelete(pet)"
        >
          删除
        </button>
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

.pet-status {
  margin: 0 0 10px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--bg-soft);
  color: var(--accent-text);
  font-size: 12px;
}

.pet-status.error {
  background: var(--bg-danger);
  color: var(--text-danger);
}

.pet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 12px;
}

.pet-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-surface);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.pet-card:hover {
  border-color: var(--accent-soft);
}

.pet-card.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.pet-card--placeholder {
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
  cursor: default;
}

.pet-preview {
  width: 56px;
  height: 56px;
  object-fit: contain;
  pointer-events: none;
}

.pet-name {
  font-size: 12px;
  color: var(--text-primary);
  text-align: center;
}

.pet-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--accent);
  color: #ffffff;
  font-size: 10px;
}

.pet-delete {
  margin-top: 2px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
}

.pet-delete:hover {
  color: var(--text-danger);
}
</style>
