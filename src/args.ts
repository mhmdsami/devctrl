export class UsageError extends Error {}

export interface TArgs {
  positionals: string[]
  flags: Record<string, string | true>
}

export interface TArgSpec {
  string?: string[]
  boolean?: string[]
}

export function parseArgs(argv: string[], spec: TArgSpec, cmd: string): TArgs {
  const strings = new Set(spec.string ?? [])
  const booleans = new Set(spec.boolean ?? [])
  const flags: Record<string, string | true> = {}
  const positionals: string[] = []
  let endOfFlags = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (endOfFlags || arg === '-' || !arg.startsWith('-')) {
      positionals.push(arg)
      continue
    }
    if (arg === '--') {
      endOfFlags = true
      continue
    }
    if (!arg.startsWith('--')) {
      throw new UsageError(`unknown option "${arg}" for "devctl ${cmd}" (see "devctl ${cmd} --help")`)
    }
    const body = arg.slice(2)
    const eq = body.indexOf('=')
    const name = eq === -1 ? body : body.slice(0, eq)
    let value = eq === -1 ? undefined : body.slice(eq + 1)
    if (strings.has(name)) {
      if (value === undefined) {
        value = argv[++i]
        if (value === undefined || value.startsWith('--')) {
          throw new UsageError(`--${name} needs a value (see "devctl ${cmd} --help")`)
        }
      }
      flags[name] = value
    } else if (booleans.has(name)) {
      if (value !== undefined) throw new UsageError(`--${name} does not take a value (see "devctl ${cmd} --help")`)
      flags[name] = true
    } else {
      throw new UsageError(`unknown option "--${name}" for "devctl ${cmd}" (see "devctl ${cmd} --help")`)
    }
  }
  return { positionals, flags }
}

export function flag(a: TArgs, name: string): boolean {
  return a.flags[name] === true
}

export function opt(a: TArgs, name: string): string | undefined {
  const v = a.flags[name]
  return typeof v === 'string' ? v : undefined
}

export function positional(a: TArgs, index: number, usage: string): string {
  const v = a.positionals[index]
  if (v === undefined) throw new UsageError(`missing argument (usage: devctl ${usage})`)
  return v
}
