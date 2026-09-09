import { execFileSync } from 'child_process'
import { tcpAlive } from './process'

export function portlessAvailable(): boolean {
  try {
    execFileSync('portless', ['list'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function alias(name: string, port: number): void {
  execFileSync('portless', ['alias', name, String(port)], { stdio: 'ignore' })
}

export function removeAlias(name: string): void {
  try {
    execFileSync('portless', ['alias', '--remove', name], { stdio: 'ignore' })
  } catch {
  }
}

function sanitizeLabel(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

export function dnsName(repo: string, wt: { name: string; branch: string | null }): string {
  const label = wt.branch ?? wt.name
  if (label === 'main' || label === 'master') return repo
  return `${sanitizeLabel(label)}.${repo}`
}

export async function portlessUrl(name: string): Promise<string | null> {
  if (await tcpAlive(443, 250)) return `https://${name}.localhost`
  if (await tcpAlive(1355, 250)) return `https://${name}.localhost:1355`
  return null
}
