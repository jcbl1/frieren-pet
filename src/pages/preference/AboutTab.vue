<script setup lang="ts">
import { getName, getVersion } from '@tauri-apps/api/app'
import { onMounted, ref } from 'vue'

const appName = ref('')
const appVersion = ref('')

onMounted(async () => {
  const [name, version] = await Promise.all([getName(), getVersion()])

  appName.value = name
  appVersion.value = version
})
</script>

<template>
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
</template>

<style scoped>
.group-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #8a8a8a;
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

.row-label {
  font-size: 14px;
}

.value {
  min-width: 44px;
  text-align: right;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: #6b6b6b;
}

.row.static {
  justify-content: space-between;
}
</style>
