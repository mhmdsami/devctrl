import { execFileSync, spawn } from 'child_process'
import { loadConfig } from './config'
import { shQuote } from './process'
import { colors, quiet } from './util'

const DEFAULT_PROVIDER = 'opencode-go'
const DEFAULT_MODEL = 'omen-alpha'

export function debugCommand(): string | null {
  const dbg = loadConfig().debug
  if (!dbg?.enabled) return null
  if (dbg.command?.trim()) return dbg.command.trim()
  const provider = dbg.provider?.trim() || DEFAULT_PROVIDER
  const model = dbg.model?.trim() || DEFAULT_MODEL
  return `pi --provider ${provider} --model ${model} -p --no-session --tools read,bash`
}
const runExclusive = (() => {
  let chain: Promise<void> = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task)
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
})()

function userPath(): string | undefined {
  try {
    const shell = process.env.SHELL ?? '/bin/zsh'
    return execFileSync(shell, ['-lic', 'printenv PATH'], { encoding: 'utf8', timeout: 5_000 }).trim() || undefined
  } catch {
    return undefined
  }
}

export async function debugFailure(info: { key: string; cmd: string; port: number; cwd: string; output: string }): Promise<void> {
  if (quiet()) return
  const command = debugCommand()
  if (!command) return
  const bin = command.split(/\s+/)[0]
  const env = { ...process.env }
  const path = userPath()
  if (path) env.PATH = path
  try {
    execFileSync('which', [bin], { stdio: 'ignore', timeout: 2_000, env })
  } catch {
    console.error(colors.dim(`debug agent: "${bin}" not found in PATH - skipping diagnosis`))
    return
  }

  const prompt = [
    `The devctl-managed service "${info.key}" failed to start: it never listened on port ${info.port}.`,
    `Start command (run from ${info.cwd}): ${info.cmd}`,
    'Its last output:',
    info.output.trim() || '(no output captured)',
    '',
    'Diagnose the root cause. You may read files and run read-only commands in the worktree.',
    'Do NOT modify files, install dependencies, or start/stop processes.',
    'Answer in exactly this format:',
    'ROOT CAUSE: <one sentence>',
    'FIX: <one or two concrete steps>',
  ].join('\n')

  console.log(colors.yellow(`→ asking ${bin} to diagnose ${info.key}…`))
  await runExclusive(
    () =>
      new Promise<void>((resolve) => {
        const child = spawn('bash', ['-c', `${command} ${shQuote(prompt)}`], {
          cwd: info.cwd,
          env,
          stdio: ['ignore', 'inherit', 'inherit'],
        })
        const timer = setTimeout(() => {
          console.error(colors.dim('debug agent: timed out after 180s'))
          child.kill('SIGTERM')
        }, 180_000)
        child.on('exit', () => {
          clearTimeout(timer)
          resolve()
        })
        child.on('error', (err) => {
          console.error(colors.dim(`debug agent: ${err.message}`))
          clearTimeout(timer)
          resolve()
        })
      }),
  )
}
