import { Action, ActionPanel, Detail } from '@raycast/api'
import { useEffect, useState } from 'react'
import { spawnDevctl } from './lib/devctl'

export default function Diagnose({ target, title }: { target: string; title: string }) {
  const [output, setOutput] = useState('Starting the debug agent…')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    let buffer = ''
    const handle = spawnDevctl(['diagnose', target], (chunk) => {
      if (cancelled) return
      buffer += chunk
      setOutput(buffer)
    })
    void handle.promise.finally(() => {
      if (!cancelled) setDone(true)
    })
    return () => {
      cancelled = true
      handle.kill()
    }
  }, [target])

  return (
    <Detail
      isLoading={!done}
      navigationTitle={`Diagnose ${title}`}
      markdown={`## Diagnosing \`${target}\`\n\nThe debug agent reads the service's recent logs and reports a root cause.\n\n\`\`\`\n${output.trim()}\n\`\`\``}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Diagnosis" content={output} />
        </ActionPanel>
      }
    />
  )
}
