<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import NoticeModal from '@/components/NoticeModal.vue'
import UpdateBanner from '@/components/UpdateBanner.vue'

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
    <div class="preference-body">
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
        <UpdateBanner />

        <RouterView />
      </main>
    </div>

    <NoticeModal />
  </div>
</template>

<style scoped>
.preference-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
  color: var(--text-primary);
}

.preference-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
  width: 168px;
  padding: 12px 8px;
  border-right: 1px solid var(--border);
  background: var(--bg-sidebar);
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.tab:hover {
  background: var(--bg-hover);
}

.tab.active {
  background: var(--bg-active);
  color: var(--text-primary);
  box-shadow: 0 1px 3px var(--shadow);
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
