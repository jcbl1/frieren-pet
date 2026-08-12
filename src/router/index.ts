import { createRouter, createWebHashHistory } from 'vue-router'

import Main from '../pages/main/index.vue'
import AboutTab from '../pages/preference/AboutTab.vue'
import AppearanceTab from '../pages/preference/AppearanceTab.vue'
import PetsTab from '../pages/preference/PetsTab.vue'
import Preference from '../pages/preference/index.vue'
import ShopTab from '../pages/preference/ShopTab.vue'

const routes = [
  {
    path: '/',
    component: Main,
  },
  {
    path: '/preference',
    component: Preference,
    redirect: '/preference/pets',
    children: [
      {
        path: 'pets',
        component: PetsTab,
      },
      {
        path: 'shop',
        component: ShopTab,
      },
      {
        path: 'appearance',
        component: AppearanceTab,
      },
      {
        path: 'about',
        component: AboutTab,
      },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
