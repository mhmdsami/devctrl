import fs from 'fs'

export function tailFile(file: string, lines = 30): string {
  try {
    const content = fs.readFileSync(file, 'utf8').trimEnd()
    return content.split('\n').slice(-lines).join('\n')
  } catch {
    return '(no log output yet)'
  }
}
