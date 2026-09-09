export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'
let enabled = process.stdout.isTTY && !process.env.NO_COLOR
let quietMode = false

export function setColorEnabled(value: boolean): void {
  enabled = value
}

export function setQuiet(value: boolean): void {
  quietMode = value
}

export function quiet(): boolean {
  return quietMode
}

export function out(...parts: unknown[]): void {
  if (!quietMode) console.log(...parts)
}

function paint(code: string, value: string): string {
  return enabled ? code + value + RESET : value
}

export const colors = {
  dim: (s: string) => paint(DIM, s),
  green: (s: string) => paint(GREEN, s),
  red: (s: string) => paint(RED, s),
  yellow: (s: string) => paint(YELLOW, s),
}
