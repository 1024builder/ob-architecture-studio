import { isSupabaseConfigured } from '../lib/supabaseClient'

export type ObcpSyncState = 'local' | 'signedOut' | 'syncing' | 'synced' | 'failed'

export type ObcpSyncStatusSnapshot = {
  configured: boolean
  loggedIn: boolean
  email?: string
  state: ObcpSyncState
  lastSyncAt?: string
  lastError?: string
}

const STORAGE_KEY = 'ob-architecture-studio:obcp-sync-status'
export const OBCP_SYNC_STATUS_CHANGED_EVENT =
  'ob-architecture-studio:obcp-sync-status-changed'

export function getObcpSyncStatus(): ObcpSyncStatusSnapshot {
  const fallback: ObcpSyncStatusSnapshot = {
    configured: isSupabaseConfigured,
    loggedIn: false,
    state: isSupabaseConfigured ? 'signedOut' : 'local',
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const stored = JSON.parse(raw) as Partial<ObcpSyncStatusSnapshot>
    return {
      ...fallback,
      ...stored,
      configured: isSupabaseConfigured,
      state: isSupabaseConfigured ? stored.state ?? fallback.state : 'local',
      loggedIn: isSupabaseConfigured && Boolean(stored.loggedIn),
    }
  } catch {
    return fallback
  }
}

export function updateObcpSyncStatus(
  patch: Partial<ObcpSyncStatusSnapshot>,
) {
  const next: ObcpSyncStatusSnapshot = {
    ...getObcpSyncStatus(),
    ...patch,
    configured: isSupabaseConfigured,
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The current page still receives the in-memory event when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(OBCP_SYNC_STATUS_CHANGED_EVENT, {
    detail: next,
  }))
  return next
}

export function clearObcpSyncAccount() {
  return updateObcpSyncStatus({
    loggedIn: false,
    email: undefined,
    state: isSupabaseConfigured ? 'signedOut' : 'local',
  })
}
