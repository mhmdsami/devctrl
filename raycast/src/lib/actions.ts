import { showToast, Toast } from '@raycast/api'
import { runLongCommand } from './devctl'

function lastOutputLine(output: string): string {
  return output.trim().split('\n').at(-1) || 'Done'
}

export async function withToast(title: string, args: string[], reload?: () => void): Promise<void> {
  const toast = await showToast({ style: Toast.Style.Animated, title })
  try {
    toast.message = lastOutputLine(await runLongCommand(args))
    toast.style = Toast.Style.Success
  } catch (error) {
    toast.message = error instanceof Error ? error.message.split('\n')[0] : String(error)
    toast.style = Toast.Style.Failure
  } finally {
    reload?.()
  }
}
