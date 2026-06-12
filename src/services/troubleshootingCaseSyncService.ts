import type { TroubleshootingCase } from '../data/troubleshootingTypes'
import {
  isSupabaseConfigured,
  SupabaseRequestError,
  supabaseRequest,
  type SupabaseSession,
} from '../lib/supabaseClient'
import {
  saveCustomTroubleshootingCases,
  validateTroubleshootingCase,
} from '../utils/troubleshootingImportExport'

export type TroubleshootingCaseSyncState =
  'local' | 'signedOut' | 'syncing' | 'synced' | 'failed'

export type TroubleshootingCaseSyncStatus = {
  configured: boolean
  loggedIn: boolean
  state: TroubleshootingCaseSyncState
  localCount: number
  cloudCount: number
  lastSyncAt?: string
  lastError?: string
}

type CloudTroubleshootingCase = {
  id: string
  user_id: string
  case_id: string
  title: string
  database_type: TroubleshootingCase['databaseType']
  fault_type: string
  severity: TroubleshootingCase['severity']
  status: TroubleshootingCase['status']
  summary: string
  symptoms: string[]
  impact: string
  root_cause: string
  solution: string[]
  troubleshooting_steps: TroubleshootingCase['troubleshootingSteps']
  commands: TroubleshootingCase['commands']
  verification: string[]
  rollback_plan: string[]
  lessons_learned: string[]
  related_components: string[]
  related_knowledge_points: string[]
  tags: string[]
  source: string
  created_at: string
  updated_at: string
}

const STATUS_STORAGE_KEY =
  'ob-architecture-studio:troubleshooting-case-sync-status'
export const TROUBLESHOOTING_CASE_SYNC_STATUS_CHANGED_EVENT =
  'ob-architecture-studio:troubleshooting-case-sync-status-changed'

export class TroubleshootingCaseSyncError extends Error {
  requiresLogin: boolean

  constructor(message: string, requiresLogin = false) {
    super(message)
    this.name = 'TroubleshootingCaseSyncError'
    this.requiresLogin = requiresLogin
  }
}

export function getTroubleshootingCaseSyncStatus(): TroubleshootingCaseSyncStatus {
  const fallback: TroubleshootingCaseSyncStatus = {
    configured: isSupabaseConfigured,
    loggedIn: false,
    state: isSupabaseConfigured ? 'signedOut' : 'local',
    localCount: 0,
    cloudCount: 0,
  }
  try {
    const raw = window.localStorage.getItem(STATUS_STORAGE_KEY)
    if (!raw) return fallback
    const stored = JSON.parse(raw) as Partial<TroubleshootingCaseSyncStatus>
    return {
      ...fallback,
      ...stored,
      configured: isSupabaseConfigured,
      loggedIn: isSupabaseConfigured && Boolean(stored.loggedIn),
      state: isSupabaseConfigured ? stored.state ?? fallback.state : 'local',
    }
  } catch {
    return fallback
  }
}

export function updateTroubleshootingCaseSyncStatus(
  patch: Partial<TroubleshootingCaseSyncStatus>,
) {
  const next: TroubleshootingCaseSyncStatus = {
    ...getTroubleshootingCaseSyncStatus(),
    ...patch,
    configured: isSupabaseConfigured,
  }
  try {
    window.localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The current page still receives the status event.
  }
  window.dispatchEvent(new CustomEvent(
    TROUBLESHOOTING_CASE_SYNC_STATUS_CHANGED_EVENT,
    { detail: next },
  ))
  return next
}

export function clearTroubleshootingCaseSyncAccount(localCount: number) {
  return updateTroubleshootingCaseSyncStatus({
    loggedIn: false,
    state: isSupabaseConfigured ? 'signedOut' : 'local',
    localCount,
    lastError: undefined,
  })
}

export async function syncTroubleshootingCases(
  session: SupabaseSession,
  localCases: TroubleshootingCase[],
  builtInCaseIds: ReadonlySet<string>,
) {
  updateTroubleshootingCaseSyncStatus({
    loggedIn: true,
    state: 'syncing',
    localCount: localCases.length,
    lastError: undefined,
  })
  try {
    const cloudRows = await selectCloudCases(session)
    const cloudCases = cloudRows
      .map(fromCloudCase)
      .filter((item): item is TroubleshootingCase =>
        item !== null && !builtInCaseIds.has(item.caseId),
      )
    const normalizedLocal = localCases
      .filter((item) => !builtInCaseIds.has(item.caseId))
      .map(normalizeLocalCase)
    const mergedCases = mergeByLatestUpdate(normalizedLocal, cloudCases)
    await upsertCloudCases(mergedCases, session)
    saveCustomTroubleshootingCases(mergedCases)
    const syncedAt = new Date().toISOString()
    updateTroubleshootingCaseSyncStatus({
      loggedIn: true,
      state: 'synced',
      localCount: mergedCases.length,
      cloudCount: mergedCases.length,
      lastSyncAt: syncedAt,
      lastError: undefined,
    })
    return {
      cases: mergedCases,
      localCount: mergedCases.length,
      cloudCount: mergedCases.length,
      syncedAt,
    }
  } catch (error) {
    const syncError = normalizeCaseSyncError(error)
    updateTroubleshootingCaseSyncStatus({
      loggedIn: !syncError.requiresLogin,
      state: 'failed',
      localCount: localCases.length,
      lastError: syncError.message,
    })
    throw syncError
  }
}

export async function deleteCloudTroubleshootingCase(
  session: SupabaseSession,
  caseId: string,
) {
  await deleteCloudCases(
    session,
    `&case_id=eq.${encodeURIComponent(caseId)}`,
  )
  const current = getTroubleshootingCaseSyncStatus()
  updateTroubleshootingCaseSyncStatus({
    loggedIn: true,
    state: 'synced',
    cloudCount: Math.max(0, current.cloudCount - 1),
    localCount: Math.max(0, current.localCount - 1),
    lastSyncAt: new Date().toISOString(),
    lastError: undefined,
  })
}

export async function deleteAllCloudTroubleshootingCases(
  session: SupabaseSession,
) {
  await deleteCloudCases(session, '')
  updateTroubleshootingCaseSyncStatus({
    loggedIn: true,
    state: 'synced',
    cloudCount: 0,
    localCount: 0,
    lastSyncAt: new Date().toISOString(),
    lastError: undefined,
  })
}

async function deleteCloudCases(session: SupabaseSession, caseFilter: string) {
  try {
    await supabaseRequest(
      `/rest/v1/troubleshooting_custom_cases?user_id=eq.${encodeURIComponent(session.user.id)}${caseFilter}`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
      session.accessToken,
    )
  } catch (error) {
    throw normalizeCaseSyncError(error)
  }
}

async function selectCloudCases(session: SupabaseSession) {
  return supabaseRequest<CloudTroubleshootingCase[]>(
    `/rest/v1/troubleshooting_custom_cases?user_id=eq.${encodeURIComponent(session.user.id)}&select=*`,
    { method: 'GET' },
    session.accessToken,
  )
}

async function upsertCloudCases(
  cases: TroubleshootingCase[],
  session: SupabaseSession,
) {
  if (!cases.length) return
  await supabaseRequest(
    '/rest/v1/troubleshooting_custom_cases?on_conflict=user_id,case_id',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(cases.map((item) => toCloudCase(item, session.user.id))),
    },
    session.accessToken,
  )
}

function mergeByLatestUpdate(
  localCases: TroubleshootingCase[],
  cloudCases: TroubleshootingCase[],
) {
  const merged = new Map<string, TroubleshootingCase>()
  ;[...cloudCases, ...localCases].forEach((item) => {
    const existing = merged.get(item.caseId)
    if (!existing || getUpdatedTimestamp(item) >= getUpdatedTimestamp(existing)) {
      merged.set(item.caseId, item)
    }
  })
  return [...merged.values()].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )
}

function normalizeLocalCase(item: TroubleshootingCase): TroubleshootingCase {
  const now = new Date().toISOString()
  return {
    ...item,
    source: item.source ?? 'json_import',
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || item.createdAt || now,
  }
}

function getUpdatedTimestamp(item: TroubleshootingCase) {
  const timestamp = Date.parse(item.updatedAt || item.createdAt)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function toCloudCase(
  item: TroubleshootingCase,
  userId: string,
): Omit<CloudTroubleshootingCase, 'id'> {
  const normalized = normalizeLocalCase(item)
  return {
    user_id: userId,
    case_id: normalized.caseId,
    title: normalized.title,
    database_type: normalized.databaseType,
    fault_type: normalized.faultType,
    severity: normalized.severity,
    status: normalized.status,
    summary: normalized.summary,
    symptoms: normalized.symptoms,
    impact: normalized.impact,
    root_cause: normalized.rootCause,
    solution: normalized.solution,
    troubleshooting_steps: normalized.troubleshootingSteps,
    commands: normalized.commands,
    verification: normalized.verification,
    rollback_plan: normalized.rollbackPlan ?? [],
    lessons_learned: normalized.lessonsLearned,
    related_components: normalized.relatedComponents,
    related_knowledge_points: normalized.relatedKnowledgePoints,
    tags: normalized.tags,
    source: normalized.source ?? 'json_import',
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  }
}

function fromCloudCase(row: CloudTroubleshootingCase): TroubleshootingCase | null {
  const validation = validateTroubleshootingCase({
    caseId: row.case_id,
    title: row.title,
    databaseType: row.database_type,
    faultType: row.fault_type,
    severity: row.severity,
    status: row.status,
    summary: row.summary,
    symptoms: row.symptoms,
    impact: row.impact,
    rootCause: row.root_cause,
    solution: row.solution,
    troubleshootingSteps: row.troubleshooting_steps,
    commands: row.commands,
    verification: row.verification,
    rollbackPlan: row.rollback_plan,
    lessonsLearned: row.lessons_learned,
    relatedComponents: row.related_components,
    relatedKnowledgePoints: row.related_knowledge_points,
    tags: row.tags,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
  return validation.valid ? validation.item : null
}

function normalizeCaseSyncError(error: unknown) {
  if (error instanceof SupabaseRequestError) {
    if (error.status === 401) {
      return new TroubleshootingCaseSyncError(
        '登录状态已失效，请重新登录后同步故障案例。',
        true,
      )
    }
    if (error.status === 403) {
      return new TroubleshootingCaseSyncError(
        '故障案例 RLS 权限校验失败，请检查 Supabase 策略。',
      )
    }
    if (error.status === 404 || error.message.includes('PGRST205')) {
      return new TroubleshootingCaseSyncError(
        '云端故障案例表不存在，请先执行 v0.8.0 Supabase SQL。',
      )
    }
    if (!error.status) {
      return new TroubleshootingCaseSyncError(
        error.message || '网络异常，故障案例已保留在本地。',
      )
    }
    return new TroubleshootingCaseSyncError(
      `故障案例云端操作失败（HTTP ${error.status}），本地案例已保留。`,
    )
  }
  return error instanceof TroubleshootingCaseSyncError
    ? error
    : new TroubleshootingCaseSyncError('故障案例同步失败，本地案例已保留。')
}
