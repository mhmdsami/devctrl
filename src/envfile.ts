import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

export type TEnvMap = Record<string, string>

export function parseEnvFile(text: string): TEnvMap {
  const map: TEnvMap = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1)
    }
    map[key] = value
  }
  return map
}

export function serializeEnv(map: TEnvMap): string {
  return (
    Object.entries(map)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n'
  )
}

function writeAtomic(file: string, content: string): void {
  const tmp = file + '.devctl-tmp'
  fs.writeFileSync(tmp, content)
  fs.renameSync(tmp, file)
}

function rootIgnoredFiles(repoPath: string): string[] {
  try {
    const out = execFileSync(
      'git',
      ['-C', repoPath, 'ls-files', '--others', '--ignored', '--exclude-standard', '--full-name'],
      { encoding: 'utf8' },
    )
    return out.split('\n').filter((line) => line && !line.includes('/'))
  } catch {
    return []
  }
}

export function seedEnvFiles(worktreePath: string, mainRepoPath: string): string[] {
  const seeded: string[] = []
  const candidates = new Set([
    ...fs.readdirSync(mainRepoPath).filter((name) => name.startsWith('.env')),
    ...rootIgnoredFiles(mainRepoPath),
  ])
  for (const name of candidates) {
    if (name.includes('/')) continue
    const target = path.join(worktreePath, name)
    if (fs.existsSync(target)) continue
    fs.copyFileSync(path.join(mainRepoPath, name), target)
    seeded.push(name)
  }
  return seeded
}

export function writeEnvOverlay(
  worktreePath: string,
  baseFileName: string,
  overrides: TEnvMap,
): TEnvMap {
  const baseMap = parseEnvFile(
    fs.readFileSync(path.join(worktreePath, baseFileName), 'utf8'),
  )
  const merged = { ...baseMap, ...overrides }
  writeAtomic(path.join(worktreePath, '.env.local'), serializeEnv(merged))
  return merged
}
