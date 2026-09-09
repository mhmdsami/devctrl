import { worktrees, type TWorktreeInfo } from './devctl'
import { usePollingValue } from './usePollingValue'

export function useWorktrees() {
  const result = usePollingValue<TWorktreeInfo[]>(worktrees)
  return {
    worktrees: result.data ?? [],
    error: result.error?.message ?? null,
    isLoading: result.isLoading,
    reload: result.reload,
  }
}
