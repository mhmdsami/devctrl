import fs from 'fs'
import path from 'path'
import { parseEnvFile, seedEnvFiles, writeEnvOverlay } from './envfile'
import { interpolate, loadConfig, repoDir, type TDevctlConfig, type TServiceConfig } from './config'
import { isShared, listWorktrees, type TRepoKey, type TWorktree } from './registry'
import type { TDevctlState, TStackDef } from './state'

export interface TStackPlan {
  path: string
  port: number
  cmd: string
  env: Record<string, string>
  healthTimeoutMs: number
}

export type TTarget = { kind: 'local'; name: string } | { kind: 'remote'; mode: 'test' | 'prod' }

export function serviceOf(repo: TRepoKey): TServiceConfig {
  const svc = loadConfig().services[repo]
  if (!svc) throw new Error(`service "${repo}" not in config`)
  return svc
}

export function providersOf(repo: TRepoKey): string[] {
  const svc = serviceOf(repo)
  const out = new Set<string>()
  for (const ref of Object.values(svc.wiring ?? {})) out.add(ref.split('.', 2)[0])
  for (const d of svc.dependsOn ?? []) out.add(d)
  return [...out]
}

export function dependentsOf(service: string): string[] {
  const cfg = loadConfig()
  return Object.entries(cfg.services)
    .filter(([, svc]) => providersOfSvc(svc).includes(service))
    .map(([name]) => name)
}

function providersOfSvc(svc: TServiceConfig): string[] {
  const out = new Set<string>()
  for (const ref of Object.values(svc.wiring ?? {})) out.add(ref.split('.', 2)[0])
  for (const d of svc.dependsOn ?? []) out.add(d)
  return [...out]
}

export function hasWiring(repo: TRepoKey): boolean {
  const svc = serviceOf(repo)
  return Boolean(svc.wiring && Object.keys(svc.wiring).length > 0)
}

function normalizeTarget(provider: string, raw: string): string {
  const prefix = `${provider}/`
  return raw.startsWith(prefix) ? raw.slice(prefix.length) : raw
}

export function targetFor(
  state: Pick<TDevctlState, 'env' | 'targets'>,
  consumer: string,
  provider: string,
  stackDef?: TStackDef,
): TTarget {
  const raw = stackDef?.services[provider] ?? state.targets[consumer] ?? state.env
  if (raw === 'test' || raw === 'prod') return { kind: 'remote', mode: raw }
  return { kind: 'local', name: normalizeTarget(provider, raw) }
}

function expandVarsLocal(map: Record<string, string>): Record<string, string> {
  const out = { ...map }
  for (let pass = 0; pass < 10; pass++) {
    let changed = false
    for (const [key, value] of Object.entries(out)) {
      const expanded = value.replace(/\$\{([A-Z0-9_]+)\}|\$([A-Z0-9_]+)/g, (whole, a, b) => {
        const ref = out[a ?? b]
        if (ref === undefined) return whole
        changed = true
        return ref
      })
      if (expanded !== value) out[key] = expanded
    }
    if (!changed) break
  }
  return out
}

function remoteValue(cfg: TDevctlConfig, mode: 'test' | 'prod', provider: string, value: string): string | null {
  const rs = serviceOf(provider).remoteProvides?.[value]
  if (!rs) return null
  const envFile = path.join(repoDir(rs.from), cfg.envBaseFiles[mode])
  const expanded = expandVarsLocal(parseEnvFile(fs.readFileSync(envFile, 'utf8')))
  return expanded[rs.envKey] ?? null
}

export function resolveWiring(
  state: Pick<TDevctlState, 'env' | 'targets'>,
  consumer: string,
  stackDef?: TStackDef,
): Record<string, string | null> {
  const cfg = loadConfig()
  const svc = serviceOf(consumer)
  const values: Record<string, string | null> = {}
  for (const [envKey, ref] of Object.entries(svc.wiring ?? {})) {
    const [provider, value] = ref.split('.', 2) as [string, string]
    const target = targetFor(state, consumer, provider, stackDef)
    if (target.kind === 'remote') {
      values[envKey] = remoteValue(cfg, target.mode, provider, value)
      continue
    }
    const wt = listWorktrees(provider).find((w) => w.name === target.name)
    if (!wt) throw new Error(`No ${provider} worktree for "${target.name}"`)
    const template = serviceOf(provider).provides?.[value]
    values[envKey] = template ? interpolate(template, { port: wt.port, inspectPort: wt.inspectPort ?? '' }) : null
  }
  return values
}

export type TDep = { kind: 'service'; repo: TRepoKey; worktree: string | null }
export function depsOf(
  state: Pick<TDevctlState, 'env' | 'targets'>,
  repo: TRepoKey,
  stackDef?: TStackDef,
): TDep[] {
  const deps: TDep[] = []
  for (const provider of providersOf(repo)) {
    if (isShared(provider)) {
      deps.push({ kind: 'service', repo: provider, worktree: null })
      continue
    }
    const target = targetFor(state, repo, provider, stackDef)
    if (target.kind === 'local') deps.push({ kind: 'service', repo: provider, worktree: target.name })
  }
  return deps
}

export function planStack(
  repo: TRepoKey,
  wt: TWorktree,
  state: Pick<TDevctlState, 'env' | 'targets'>,
  stackDef?: TStackDef,
): TStackPlan {
  const cfg = loadConfig()
  const svc = serviceOf(repo)

  if (!svc.shared) seedEnvFiles(wt.path, repoDir(repo))

  const vars = { port: wt.port, inspectPort: wt.inspectPort }
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(svc.env ?? {})) env[key] = interpolate(value, vars)

  const externals = svc.envExternals?.[state.env]
  if (externals) Object.assign(env, externals)

  const wiring = svc.wiring ?? {}
  if (!svc.shared && Object.keys(wiring).length > 0) {
    const values = resolveWiring(state, repo, stackDef)
    const overrides: Record<string, string> = {}
    for (const [key, value] of Object.entries(values)) {
      if (value !== null) overrides[key] = value
    }
    const merged = writeEnvOverlay(wt.path, cfg.envBaseFiles[state.env], overrides)
    for (const key of svc.overlayManagedKeys ?? []) {
      if (merged[key]) env[key] = merged[key]
    }
  }

  return { path: wt.path, port: wt.port, cmd: interpolate(svc.command, vars), env, healthTimeoutMs: svc.healthTimeoutMs }
}
