<script setup lang="ts">
import { getName, getVersion } from '@tauri-apps/api/app'
import { open } from '@tauri-apps/plugin-dialog'
import { onMounted, onBeforeUnmount, ref } from 'vue'

import { deletePet, importPet, loadPetCatalog } from '@/services/petCatalog'
import type { PetEntry } from '@/services/petCatalog'
import { readPetIdFromDir } from '@/services/petConfig'
import { usePetStore } from '@/stores/pet'

const petStore = usePetStore()

const appName = ref('')
const appVersion = ref('')
const pets = ref<PetEntry[]>([])
const petLoading = ref(true)
const petStatus = ref<{ message: string; isError: boolean } | null>(null)

let statusTimer: ReturnType<typeof setTimeout> | undefined

onMounted(async () => {
  const [name, version] = await Promise.all([getName(), getVersion()])

  appName.value = name
  appVersion.value = version

  try {
    pets.value = await loadPetCatalog()
  } catch (error) {
    console.error('[frieren-pet] load pet catalog failed:', error)
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
  <div class="preference-root">
    <main class="content">
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

      <section class="group">
        <h2 class="group-title">窗口</h2>

        <div class="row">
          <div class="row-text">
            <span class="row-label">缩放</span>
            <span class="row-desc">20% – 150%</span>
          </div>

          <input
            v-model.number="petStore.scale"
            class="range"
            type="range"
            min="20"
            max="150"
            step="1"
          >

          <span class="value">{{ petStore.scale }}%</span>
        </div>

        <div class="row">
          <div class="row-text">
            <span class="row-label">透明度</span>
            <span class="row-desc">10% – 100%</span>
          </div>

          <input
            v-model.number="petStore.opacity"
            class="range"
            type="range"
            min="10"
            max="100"
            step="1"
          >

          <span class="value">{{ petStore.opacity }}%</span>
        </div>

        <div class="row">
          <div class="row-text">
            <span class="row-label">始终置顶</span>
            <span class="row-desc">宠物窗口保持在其它窗口上方</span>
          </div>

          <button
            class="switch"
            :class="{ on: petStore.alwaysOnTop }"
            type="button"
            role="switch"
            :aria-checked="petStore.alwaysOnTop"
            @click="petStore.alwaysOnTop = !petStore.alwaysOnTop"
          >
            <span class="knob" />
          </button>
        </div>

        <div class="row">
          <div class="row-text">
            <span class="row-label">鼠标穿透</span>
            <span class="row-desc">点击会直接穿过宠物。开启后请通过托盘菜单恢复</span>
          </div>

          <button
            class="switch"
            :class="{ on: petStore.passThrough }"
            type="button"
            role="switch"
            :aria-checked="petStore.passThrough"
            @click="petStore.passThrough = !petStore.passThrough"
          >
            <span class="knob" />
          </button>
        </div>
      </section>

      <section class="group">
        <h2 class="group-title">关于</h2>

        <div class="row static">
          <span class="row-label">应用</span>
          <span class="value">{{ appName }}</span>
        </div>

        <div class="row static">
          <span class="row-label">版本</span>
          <span class="value">{{ appVersion }}</span>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.preference-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fafafa;
  color: #2d2d2d;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.group {
  margin-bottom: 20px;
}

.group-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #8a8a8a;
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.group-action {
  margin-bottom: 8px;
  padding: 4px 10px;
  border: 1px solid #7c9a7c;
  border-radius: 6px;
  background: #ffffff;
  color: #7c9a7c;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.group-action:hover {
  background: #7c9a7c;
  color: #ffffff;
}

.pet-status {
  margin: 0 0 10px;
  padding: 6px 10px;
  border-radius: 6px;
  background: #eef4ee;
  color: #5a7a5a;
  font-size: 12px;
}

.pet-status.error {
  background: #fbecec;
  color: #b05050;
}

.group:not(:first-child) .group-title {
  margin-top: 20px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid #efefef;
}

.row:last-child {
  border-bottom: none;
}

.row-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.row-label {
  font-size: 14px;
}

.row-desc {
  font-size: 12px;
  color: #8a8a8a;
}

.value {
  min-width: 44px;
  text-align: right;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: #6b6b6b;
}

.range {
  width: 160px;
  accent-color: #7c9a7c;
}

.switch {
  position: relative;
  width: 42px;
  height: 24px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: #d0d0d0;
  cursor: pointer;
  transition: background 0.15s ease;
}

.switch.on {
  background: #7c9a7c;
}

.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
  transition: transform 0.15s ease;
}

.switch.on .knob {
  transform: translateX(18px);
}

.row.static {
  justify-content: space-between;
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
  border: 1px solid #e6e6e6;
  border-radius: 10px;
  background: #ffffff;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.pet-card:hover {
  border-color: #b8ccb8;
}

.pet-card.active {
  border-color: #7c9a7c;
  box-shadow: 0 0 0 1px #7c9a7c;
}

.pet-card--placeholder {
  justify-content: center;
  color: #8a8a8a;
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
  color: #2d2d2d;
  text-align: center;
}

.pet-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 1px 5px;
  border-radius: 4px;
  background: #7c9a7c;
  color: #ffffff;
  font-size: 10px;
}

.pet-delete {
  margin-top: 2px;
  padding: 0;
  border: none;
  background: transparent;
  color: #b0b0b0;
  font-size: 11px;
  cursor: pointer;
}

.pet-delete:hover {
  color: #d06565;
}
</style>
