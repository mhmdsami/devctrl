export function parseJsonc<T = unknown>(text: string, source: string): T {
  const stripped = stripJsonc(text)
  try {
    return JSON.parse(stripped) as T
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`${source}: ${msg}`)
  }
}

function stripJsonc(input: string): string {
  let out = ''
  let i = 0
  const n = input.length
  let inString = false
  let quote = ''
  let escape = false
  while (i < n) {
    const ch = input[i]
    const next = input[i + 1]
    if (inString) {
      out += ch
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === quote) {
        inString = false
        quote = ''
      }
      i++
      continue
    }
    if (ch === '"' || ch === "'") {
      inString = true
      quote = ch
      out += ch
      i++
      continue
    }
    if (ch === '/' && next === '/') {
      while (i < n && input[i] !== '\n') i++
      continue
    }
    if (ch === '/' && next === '*') {
      i += 2
      while (i < n && !(input[i] === '*' && input[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (ch === ',') {
      let j = i + 1
      while (j < n && /\s/.test(input[j])) j++
      if (input[j] === '}' || input[j] === ']') {
        i++
        continue
      }
    }
    out += ch
    i++
  }
  return out
}