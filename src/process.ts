import net from 'net'
import { execFileSync } from 'child_process'
import { sleepSync } from './util'

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function processStartToken(pid: number): string | null {
  try {
    return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' }).trim() || null
  } catch {
    return null
  }
}

export function processMatches(pid: number, startToken?: string): boolean {
  if (!isAlive(pid)) return false
  return !startToken || processStartToken(pid) === startToken
}

export function pgidOf(pid: number): number | null {
  try {
    const out = execFileSync('ps', ['-o', 'pgid=', '-p', String(pid)], { encoding: 'utf8' }).trim()
    return Number(out) || null
  } catch {
    return null
  }
}

function parentPidOf(pid: number): number | null {
  try {
    return Number(execFileSync('ps', ['-o', 'ppid=', '-p', String(pid)], { encoding: 'utf8' }).trim()) || null
  } catch {
    return null
  }
}

export function isDescendantOf(pid: number, ancestorPid: number): boolean {
  let current: number | null = pid
  const seen = new Set<number>()
  while (current && current > 1 && !seen.has(current)) {
    if (current === ancestorPid) return true
    seen.add(current)
    current = parentPidOf(current)
  }
  return false
}

export function killTree(pid: number, startToken?: string): boolean {
  if (!processMatches(pid, startToken)) return false
  const pgid = pgidOf(pid)
  for (const signal of ['SIGTERM', 'SIGKILL'] as const) {
    if (!processMatches(pid, startToken)) return true
    try {
      if (pgid && pgid !== process.pid && pgid !== process.ppid) process.kill(-pgid, signal)
      else process.kill(pid, signal)
    } catch {
      return !processMatches(pid, startToken)
    }
    for (let i = 0; i < 20; i++) {
      if (!processMatches(pid, startToken)) return true
      sleepSync(150)
    }
  }
  return !processMatches(pid, startToken)
}

export function pidsListeningOnPort(port: number): number[] {
  try {
    const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' })
    return [...new Set(out.split('\n').map(Number).filter(Boolean))]
  } catch {
    return []
  }
}

export function ownedPidsOnPort(port: number, ownerPid?: number, ownerStartToken?: string): number[] {
  if (!ownerPid || !processMatches(ownerPid, ownerStartToken)) return []
  return pidsListeningOnPort(port).filter((pid) => isDescendantOf(pid, ownerPid))
}

export function tcpAlive(port: number, timeoutMs = 750): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

export function shQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

export function envExports(env: Record<string, string>): string {
  const entries = Object.entries(env)
  if (entries.length === 0) return ''
  return `export ${entries.map(([k, v]) => `${k}=${shQuote(v)}`).join(' ')}; `
}
