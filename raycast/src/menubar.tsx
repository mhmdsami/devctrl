import { Clipboard, Icon, MenuBarExtra, open, showToast, Toast } from '@raycast/api'
import { run, serviceLogs } from './lib/devctl'
import { useDevctlStatus } from './lib/useDevctlStatus'
import { useStacks } from './lib/useStacks'
import { withToast } from './lib/actions'
import { serviceStateLabel, stackView, type ServiceState } from './lib/stackView'

const stateIcon = (state: ServiceState | 'external') => {
  if (state === 'ready') return { source: Icon.CircleFilled, tintColor: '#34c759' }
  if (state === 'starting') return { source: Icon.Clock, tintColor: '#ffcc00' }
  if (state === 'failed') return { source: Icon.ExclamationMark, tintColor: '#ff3b30' }
  if (state === 'external' || state.startsWith('external-')) return { source: Icon.Globe, tintColor: '#0a84ff' }
  return { source: Icon.Circle, tintColor: '#8e8e93' }
}

export default function Menubar() {
  const { status, error: statusError, isLoading, reload: reloadStatus } = useDevctlStatus(2_000)
  const { stacks, error: stacksError, reload: reloadStacks } = useStacks(5_000)
  const rows = (stacks?.stacks ?? []).map((stack) => stackView(stack, status))
  const failed = rows.filter((row) => row.state === 'failed').length
  const starting = rows.filter((row) => row.state === 'starting').length
  const active = rows.filter((row) => row.state === 'ready' || row.state === 'external').length
  const title = failed
    ? `${failed} failed`
    : starting
      ? `${starting} starting`
      : active
        ? String(active)
        : undefined
  const icon = failed
    ? { source: Icon.Terminal, tintColor: '#ff3b30' }
    : starting
      ? { source: Icon.Terminal, tintColor: '#ffcc00' }
      : { source: Icon.Terminal, tintColor: active ? '#34c759' : '#8e8e93' }
  const reload = () => {
    reloadStatus()
    reloadStacks()
  }

  return (
    <MenuBarExtra icon={icon} title={title} isLoading={isLoading}>
      {(statusError || stacksError) && <MenuBarExtra.Item icon={Icon.ExclamationMark} title={`devctl error: ${statusError ?? stacksError}`} />}
      <MenuBarExtra.Section title="Stacks">
        {rows.map((row) => (
          <MenuBarExtra.Submenu
            key={row.id}
            icon={stateIcon(row.state === 'external' ? 'external' : row.state)}
            title={`${row.title} (${row.ready}/${row.localTotal} local)`}
          >
            {row.services.map((service) => (
              <MenuBarExtra.Submenu
                key={service.repo}
                icon={stateIcon(service.state)}
                title={`${service.repo}/${service.target} · ${serviceStateLabel(service.state)}`}
              >
                {service.url && <MenuBarExtra.Item icon={Icon.Globe} title="Open URL" onAction={() => open(service.url!)} />}
                {service.url && <MenuBarExtra.Item icon={Icon.CopyClipboard} title="Copy URL" onAction={() => Clipboard.copy(service.url!)} />}
                {service.local && (
                  <MenuBarExtra.Item
                    icon={Icon.Document}
                    title="Copy Recent Logs"
                    onAction={async () => {
                      try {
                        await Clipboard.copy(await serviceLogs(`${service.repo}/${service.target}`))
                        await showToast({ style: Toast.Style.Success, title: `${service.repo} logs copied` })
                      } catch (cause) {
                        await showToast({ style: Toast.Style.Failure, title: 'Unable to read logs', message: cause instanceof Error ? cause.message : String(cause) })
                      }
                    }}
                  />
                )}
              </MenuBarExtra.Submenu>
            ))}
            {row.running ? (
              <MenuBarExtra.Item icon={Icon.Stop} title="Stop Stack" onAction={() => withToast(`Stopping ${row.title}`, ['stack', 'down', row.id], reload)} />
            ) : (
              <MenuBarExtra.Item icon={Icon.Play} title="Start Stack" onAction={() => withToast(`Starting ${row.title}`, ['stack', 'up', row.id], reload)} />
            )}
            <MenuBarExtra.Item
              icon={Icon.CopyClipboard}
              title="Copy Agent Context"
              onAction={async () => {
                try {
                  await Clipboard.copy(await run(['context', row.id]))
                  await showToast({ style: Toast.Style.Success, title: `${row.title} agent context copied` })
                } catch (cause) {
                  await showToast({ style: Toast.Style.Failure, title: 'Unable to copy agent context', message: cause instanceof Error ? cause.message : String(cause) })
                }
              }}
            />
          </MenuBarExtra.Submenu>
        ))}
        {rows.length === 0 && <MenuBarExtra.Item title="No stacks. Open Manage Stack to create one." />}
      </MenuBarExtra.Section>
      <MenuBarExtra.Section title="Environment">
        <MenuBarExtra.Submenu icon={Icon.Globe} title={`Environment: ${status?.env ?? 'Loading…'}`}>
          {(['test', 'prod'] as const).map((environment) => (
            <MenuBarExtra.Item
              key={environment}
              title={environment}
              icon={status?.env === environment ? stateIcon('ready') : stateIcon('stopped')}
              onAction={() => withToast(`Switching to ${environment}`, ['env', environment], reload)}
            />
          ))}
        </MenuBarExtra.Submenu>
      </MenuBarExtra.Section>
      <MenuBarExtra.Section title="Actions">
        <MenuBarExtra.Item icon={Icon.Terminal} title="Focus Workspace" onAction={() => withToast('Focusing workspace', ['attach'])} />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  )
}
