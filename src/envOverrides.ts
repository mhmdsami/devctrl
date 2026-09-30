import fs from 'fs'
import path from 'path'
import { parseEnvFile, serializeEnv, type TEnvMap } from './envfile'
import { DEVCTL_DIR } from './state'

export function overrideFile(stack: string, service: string): string {
  return path.join(DEVCTL_DIR, 'env', stack, `${service}.env`)
}

export function readOverrides(stack: string | undefined, service: string): TEnvMap {
  if (!stack) return {}
  const file = overrideFile(stack, service)
  if (!fs.existsSync(file)) return {}
  return parseEnvFile(fs.readFileSync(file, 'utf8'))
}

export function writeOverrides(stack: string, service: string, map: TEnvMap): string {
  const file = overrideFile(stack, service)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, serializeEnv(map))
  return file
}

export function setOverride(stack: string, service: string, key: string, value: string): string {
  const map = readOverrides(stack, service)
  map[key] = value
  return writeOverrides(stack, service, map)
}

export function unsetOverride(stack: string, service: string, key: string): boolean {
  const map = readOverrides(stack, service)
  if (!(key in map)) return false
  delete map[key]
  if (Object.keys(map).length === 0) fs.rmSync(overrideFile(stack, service), { force: true })
  else writeOverrides(stack, service, map)
  return true
}
