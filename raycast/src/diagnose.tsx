import { Action, ActionPanel, Detail } from '@raycast/api'
import { useEffect, useState } from 'react'
import { spawnDevctl } from './lib/devctl'

export default function Diagnose({ target, title }: { target: string; title: string }) {
  const [output, setOutput] = useState('Starting the debug agent…')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let buffer = ''
    const handle = spawnDevctl(['diagnose', target], (chunk) => {
      buffer += chunk
      setOutput(buffer)
    })
    handle.promise.finally(() => setDone(true))
    return () => handle.kill()
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
