import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const base = process.env.SHOP_API_BASE

if (!base) {
  console.error('SHOP_API_BASE is not set; set it to enable the shop backend.')
  process.exit(1)
}

writeFileSync(
  resolve(root, '.env.production.local'),
  `VITE_SHOP_API_BASE=${base}\n`,
)

console.log(`wrote .env.production.local with VITE_SHOP_API_BASE=${base}`)
