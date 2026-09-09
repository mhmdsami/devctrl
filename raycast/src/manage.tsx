import { ActionPanel, Clipboard, confirmAlert, Icon, List, showHUD, useNavigation } from '@raycast/api'
import { run, statusJson } from './lib/devctl'
import { withToast } from './lib/actions'
import { useDevctlStatus } from './lib/useDevctlStatus'
import { useStacks } from './lib/useStacks'
import { stackView, type StackView } from './lib/stackView'
import { StackActivity } from './stack-activity'
import { StackForm } from './stack-form'

const STATE_RANK: Record<StackView['state'], number> = { failed: 0, starting: 1, stopped: 2, external: 3, ready: 4 }

function ageLabel(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return undefined
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${Math.max(minutes, 1)}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function Manage() {
  const { stacks, error: stacksError, isLoading, reload: reloadStacks } = useStacks()
  const { status, error: statusError, reload: reloadStatus } = useDevctlStatus()
  const { push } = useNavigation()
  const reload = () => {
    reloadStacks()
    reloadStatus()
  }

  if (stacksError) {
    return <List><List.EmptyView icon={Icon.ExclamationMark} title="Unable to load stacks" description={stacksError} /></List>
  }

  const views = (stacks?.stacks ?? []).map((stack) => ({ stack, view: stackView(stack, status) }))
  views.sort((a, b) => STATE_RANK[a.view.state] - STATE_RANK[b.view.state])

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search stacks…">
      {statusError && (
        <List.Section title="Runtime status unavailable">
          <List.Item icon={Icon.ExclamationMark} title="Stack definitions are still available" subtitle={statusError} />
        </List.Section>
      )}
      <List.Section title="Stacks">
        {views.map(({ stack, view }) => {
          const startedAt = (status?.stacks ?? [])
            .filter((member) => member.stack === stack.name)
            .map((member) => member.startedAt)
            .sort()
            .at(-1)
          const age = view.running ? ageLabel(startedAt) : undefined
          const statusText = view.localTotal === 0
            ? 'External only'
            : view.running
              ? `${view.ready}/${view.localTotal} ready`
              : 'Stopped'
          const icon = view.state === 'failed'
            ? { source: Icon.ExclamationMark, tintColor: '#ff3b30' }
            : view.state === 'starting'
              ? { source: Icon.Clock, tintColor: '#ffcc00' }
              : view.state === 'ready'
                ? { source: Icon.CircleFilled, tintColor: '#34c759' }
                : Icon.Circle

          return (
            <List.Item
              key={stack.name}
              icon={icon}
              title={view.title}
              subtitle={view.services.map((service) => `${service.repo}/${service.target}`).join(', ')}
              accessories={[{ text: statusText }, ...(age ? [{ text: age, tooltip: `running for ${age}` }] : [])]}
              actions={
                <ActionPanel>
                  <ActionPanel.Section title="Manage">
                    <ActionPanel.Item title="Show Services" icon={Icon.Info} onAction={() => push(<StackActivity name={stack.name} action="view" />)} />
                    <ActionPanel.Item
                      title={view.running ? 'Stop Stack' : 'Start Stack'}
                      icon={view.running ? Icon.Stop : Icon.Play}
                      onAction={() => push(<StackActivity name={stack.name} action={view.running ? 'down' : 'up'} />)}
                    />
                    <ActionPanel.Item title="Edit Services" icon={Icon.Pencil} shortcut={{ modifiers: ['cmd'], key: 'e' }} onAction={() => push(<StackForm initial={{ name: stack.name, services: stack.services, label: stack.label }} />)} />
                    {view.running && <ActionPanel.Item title="Restart Stack" icon={Icon.ArrowClockwise} shortcut={{ modifiers: ['cmd'], key: 'r' }} onAction={() => withToast(`Restarting ${view.title}`, ['restart', stack.name], reload)} />}
                    <ActionPanel.Item
                      title="Delete Stack"
                      icon={Icon.Trash}
                      style={ActionPanel.Item.Style.Destructive}
                      shortcut={{ modifiers: ['cmd'], key: 'd' }}
                      onAction={async () => {
                        const confirmed = await confirmAlert({
                          title: `Delete ${view.title}?`,
                          message: 'This stops the stack and removes it from devctl. Worktrees and branches are untouched.',
                          icon: Icon.Trash,
                        })
                        if (confirmed) await withToast(`Deleting ${view.title}`, ['stack', 'delete', stack.name, '--yes'], reload)
                      }}
                    />
                  </ActionPanel.Section>
                  <ActionPanel.Section title="Workspace">
                    <ActionPanel.Item title="Focus Workspace" icon={Icon.Terminal} shortcut={{ modifiers: ['cmd'], key: 'f' }} onAction={() => withToast('Focusing servers workspace', ['attach'], reload)} />
                  </ActionPanel.Section>
                  <ActionPanel.Section title="Export">
                    <ActionPanel.Item
                      title="Copy Agent Context"
                      icon={Icon.CopyClipboard}
                      shortcut={{ modifiers: ['cmd'], key: 'c' }}
                      onAction={async () => {
                        await Clipboard.copy(await run(['context', stack.name]))
                        await showHUD('Agent context copied')
                      }}
                    />
                    <ActionPanel.Item
                      title="Copy Status JSON"
                      icon={Icon.CopyClipboard}
                      onAction={async () => {
                        await Clipboard.copy(JSON.stringify(await statusJson(), null, 2))
                        await showHUD('Status JSON copied')
                      }}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          )
        })}
      </List.Section>
      <List.Section title="Actions">
        <List.Item
          icon={Icon.Plus}
          title="Create Stack"
          subtitle="Create or select worktrees for a feature"
          actions={<ActionPanel><ActionPanel.Item title="Create Stack" icon={Icon.Plus} onAction={() => push(<StackForm />)} /></ActionPanel>}
        />
      </List.Section>
    </List>
  )
}
