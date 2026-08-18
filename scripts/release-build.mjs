import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const version = process.argv[2]
const envPath = resolve(root, '.env.production.local')
const versionFiles = [
  'package.json',
  'src-tauri/tauri.conf.json',
  'src-tauri/Cargo.toml',
]

function fail(message) {
  console.error(`release build failed: ${message}`)
  process.exit(1)
}

function loadEnvFile(path) {
  if (!existsSync(path)) {
    fail(`missing ${path}; create it with VITE_SHOP_API_BASE and the updater signing key`)
  }

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator < 1) fail(`invalid line in ${path}: ${line}`)

    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
    if (!process.env[key]) process.env[key] = value
  }
}

function assertBase64(value) {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    fail('TAURI_SIGNING_PRIVATE_KEY must be valid base64')
  }

  const decoded = Buffer.from(value, 'base64')
  if (decoded.toString('base64') !== value) {
    fail('TAURI_SIGNING_PRIVATE_KEY must be valid base64')
  }
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`)
}

if (!/^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  fail('usage: pnpm release:build vX.Y.Z[-rc.N]')
}

loadEnvFile(envPath)
if (!process.env.VITE_SHOP_API_BASE) fail('VITE_SHOP_API_BASE is required in .env.production.local')
assertBase64(process.env.TAURI_SIGNING_PRIVATE_KEY)

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const snapshots = new Map(
  versionFiles.map((file) => [file, readFileSync(resolve(root, file))]),
)

let failure
try {
  run(pnpm, ['check'])
  run(process.execPath, ['scripts/sync-version.mjs', version])
  run(pnpm, ['tauri', 'build'])
} catch (error) {
  failure = error
} finally {
  for (const [file, contents] of snapshots) {
    writeFileSync(resolve(root, file), contents)
  }
}

if (failure) fail(failure.message)
