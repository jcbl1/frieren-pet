import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const version = process.argv[2]

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`invalid version: ${version}`)
  process.exit(1)
}

const packageJsonPath = resolve(root, 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
packageJson.version = version
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)

const tauriConfPath = resolve(root, 'src-tauri/tauri.conf.json')
const tauriConf = readFileSync(tauriConfPath, 'utf8').replace(
  /"version": "[^"]*"/,
  `"version": "${version}"`,
)
writeFileSync(tauriConfPath, tauriConf)

const cargoPath = resolve(root, 'src-tauri/Cargo.toml')
const cargo = readFileSync(cargoPath, 'utf8').replace(
  /^version = "[^"]*"$/m,
  `version = "${version}"`,
)
writeFileSync(cargoPath, cargo)

console.log(`synced version ${version} to package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml`)
