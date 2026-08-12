<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'

const tabs = [
  { name: 'pets', label: '角色', icon: '👤' },
  { name: 'shop', label: '商店', icon: '🛒' },
  { name: 'appearance', label: '外观', icon: '🎨' },
  { name: 'about', label: '关于', icon: 'ℹ️' },
]

const route = useRoute()

const activeTab = computed(() => {
  const segment = route.path.split('/')[2]

  return tabs.some((tab) => tab.name === segment) ? segment : 'pets'
})
</script>

<template>
  <div class="preference-root">
    <nav class="sidebar">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        class="tab"
        :class="{ active: activeTab === tab.name }"
        :to="`/preference/${tab.name}`"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </RouterLink>
    </nav>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.preference-root {
  display: flex;
  height: 100%;
  background: #fafafa;
  color: #2d2d2d;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
  width: 168px;
  padding: 12px 8px;
  border-right: 1px solid #e6e6e6;
  background: #f2f2f2;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: #4a4a4a;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.tab:hover {
  background: #e6e6e6;
}

.tab.active {
  background: #ffffff;
  color: #2d2d2d;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.08);
}

.tab-icon {
  font-size: 16px;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
</style>
