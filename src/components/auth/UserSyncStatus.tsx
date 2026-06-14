import {
  Check,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  RefreshCw,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { isSupabaseConfigured, type SupabaseSession } from '../../lib/supabaseClient'
import { obcpQuestions } from '../../data/obcpQuestions'
import { troubleshootingCases } from '../../data/troubleshootingCases'
import {
  AUTH_STATE_CHANGED_EVENT,
  clearExpiredSession,
  getActiveSession,
  signInWithPassword,
  signOut,
  signUpWithPassword,
} from '../../services/authService'
import {
  clearCustomQuestionSyncAccount,
  CustomQuestionSyncError,
  syncCustomQuestionBank,
} from '../../services/customQuestionSyncService'
import { ObcpSyncError, syncObcpData } from '../../services/obcpSyncService'
import {
  clearTroubleshootingCaseSyncAccount,
  syncTroubleshootingCases,
  TroubleshootingCaseSyncError,
} from '../../services/troubleshootingCaseSyncService'
import {
  clearTaxSyncAccount,
  getTaxSyncStatus,
  syncTaxQuestionData,
  TAX_SYNC_STATUS_CHANGED_EVENT,
  TaxQuestionSyncError,
  type TaxSyncStatus,
} from '../../services/taxQuestionSyncService'
import {
  clearObcpSyncAccount,
  getObcpSyncStatus,
  OBCP_SYNC_STATUS_CHANGED_EVENT,
  updateObcpSyncStatus,
  type ObcpSyncState,
  type ObcpSyncStatusSnapshot,
} from '../../services/syncStatusService'
import {
  loadCustomObcpQuestions,
} from '../../utils/obcpQuestionImportExport'
import {
  getPendingObcpRecordCount,
  OBCP_LOCAL_DATA_CHANGED_EVENT,
} from '../../utils/obcpStorage'
import { loadCustomTroubleshootingCases } from '../../utils/troubleshootingImportExport'
import {
  TAX_DATA_CHANGED_EVENT,
} from '../../utils/taxQuestionBank'

type AuthMode = 'login' | 'register'
const LOCAL_USER_ID = 'local-user'
export const USER_SIGN_OUT_REQUEST_EVENT =
  'ob-architecture-studio:user-sign-out-request'

export function UserSyncStatus() {
  const [session, setSession] = useState<SupabaseSession | null>(null)
  const [syncStatus, setSyncStatus] = useState(getObcpSyncStatus)
  const [taxSyncStatus, setTaxSyncStatus] = useState(getTaxSyncStatus)
  const [loginOpen, setLoginOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingCount, setPendingCount] = useState(() => getPendingObcpRecordCount(LOCAL_USER_ID))
  const syncTimer = useRef<number>()
  const taxSyncTimer = useRef<number>()
  const sessionRef = useRef<SupabaseSession | null>(null)

  useEffect(() => {
    let active = true

    async function initialize() {
      const nextSession = await getActiveSession()
      if (!active) return
      sessionRef.current = nextSession
      setSession(nextSession)
      if (nextSession) void runSync(nextSession)
      else {
        setTaxSyncStatus(clearTaxSyncAccount())
        const currentStatus = getObcpSyncStatus()
        const sessionExpired = currentStatus.state === 'failed'
          && currentStatus.lastError?.includes('重新登录')
        const nextStatus = updateObcpSyncStatus({
          loggedIn: false,
          email: undefined,
          state: sessionExpired
            ? 'failed'
            : isSupabaseConfigured ? 'signedOut' : 'local',
        })
        setSyncStatus(nextStatus)
      }
    }

    function handleAuthChange() {
      void initialize()
    }

    function handleLocalChange() {
      setPendingCount(getPendingObcpRecordCount(LOCAL_USER_ID))
      if (!sessionRef.current) return
      window.clearTimeout(syncTimer.current)
      syncTimer.current = window.setTimeout(() => void runSync(sessionRef.current), 900)
    }

    function handleTaxLocalChange(event: Event) {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source
      setTaxSyncStatus(getTaxSyncStatus())
      if (source === 'sync' || !sessionRef.current) return
      window.clearTimeout(taxSyncTimer.current)
      taxSyncTimer.current = window.setTimeout(
        () => void runTaxSync(sessionRef.current),
        1200,
      )
    }

    function handleSyncStatusChange(event: Event) {
      const detail = (event as CustomEvent<ObcpSyncStatusSnapshot>).detail
      setSyncStatus(detail ?? getObcpSyncStatus())
    }

    function handleTaxSyncStatusChange(event: Event) {
      const detail = (event as CustomEvent<TaxSyncStatus>).detail
      setTaxSyncStatus(detail ?? getTaxSyncStatus())
    }

    function handleSignOutRequest() {
      void handleSignOut()
    }

    void initialize()
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthChange)
    window.addEventListener(OBCP_LOCAL_DATA_CHANGED_EVENT, handleLocalChange)
    window.addEventListener(OBCP_SYNC_STATUS_CHANGED_EVENT, handleSyncStatusChange)
    window.addEventListener(TAX_DATA_CHANGED_EVENT, handleTaxLocalChange)
    window.addEventListener(TAX_SYNC_STATUS_CHANGED_EVENT, handleTaxSyncStatusChange)
    window.addEventListener(USER_SIGN_OUT_REQUEST_EVENT, handleSignOutRequest)
    return () => {
      active = false
      window.clearTimeout(syncTimer.current)
      window.clearTimeout(taxSyncTimer.current)
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthChange)
      window.removeEventListener(OBCP_LOCAL_DATA_CHANGED_EVENT, handleLocalChange)
      window.removeEventListener(OBCP_SYNC_STATUS_CHANGED_EVENT, handleSyncStatusChange)
      window.removeEventListener(TAX_DATA_CHANGED_EVENT, handleTaxLocalChange)
      window.removeEventListener(TAX_SYNC_STATUS_CHANGED_EVENT, handleTaxSyncStatusChange)
      window.removeEventListener(USER_SIGN_OUT_REQUEST_EVENT, handleSignOutRequest)
    }
  }, [])

  useEffect(() => {
    if (!loginOpen && !accountOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [accountOpen, loginOpen])

  async function runSync(activeSession = sessionRef.current) {
    if (!activeSession) return
    updateObcpSyncStatus({
      loggedIn: true,
      email: activeSession.user.email,
      state: 'syncing',
      lastError: undefined,
    })
    try {
      const result = await syncObcpData(activeSession)
      try {
        await syncCustomQuestionBank(
          activeSession,
          loadCustomObcpQuestions(),
          new Set(obcpQuestions.map((question) => question.questionId)),
        )
      } catch (error) {
        if (error instanceof CustomQuestionSyncError) {
          throw new ObcpSyncError(error.message, error.requiresLogin)
        }
        throw error
      }
      try {
        await syncTroubleshootingCases(
          activeSession,
          loadCustomTroubleshootingCases(),
          new Set(troubleshootingCases.map((item) => item.caseId)),
        )
      } catch (error) {
        if (error instanceof TroubleshootingCaseSyncError
          && error.requiresLogin) {
          throw new ObcpSyncError(error.message, true)
        }
      }
      try {
        await syncTaxQuestionData(activeSession)
      } catch (error) {
        if (error instanceof TaxQuestionSyncError && error.requiresLogin) {
          throw new ObcpSyncError(error.message, true)
        }
      }
      setPendingCount(getPendingObcpRecordCount(LOCAL_USER_ID))
      updateObcpSyncStatus({
        loggedIn: true,
        email: activeSession.user.email,
        state: 'synced',
        lastSyncAt: result.syncedAt,
        lastError: undefined,
      })
    } catch (error) {
      const syncError = error instanceof ObcpSyncError
        ? error
        : new ObcpSyncError('同步失败，已保留本地记录。')
      updateObcpSyncStatus({
        loggedIn: !syncError.requiresLogin,
        email: syncError.requiresLogin ? undefined : activeSession.user.email,
        state: 'failed',
        lastError: syncError.message,
      })
      if (syncError.requiresLogin) {
        sessionRef.current = null
        setSession(null)
        clearExpiredSession()
      }
    }
  }

  async function runTaxSync(activeSession = sessionRef.current) {
    if (!activeSession) return
    try {
      await syncTaxQuestionData(activeSession)
    } catch (error) {
      if (error instanceof TaxQuestionSyncError && error.requiresLogin) {
        sessionRef.current = null
        setSession(null)
        clearExpiredSession()
      }
    }
  }

  async function submitCredentials() {
    if (!email.trim() || !password) return
    if (password.length < 6) {
      setMessage('密码长度不足，请至少输入 6 位密码。')
      return
    }
    if (authMode === 'register' && password !== confirmPassword) {
      setMessage('两次输入的密码不一致。')
      return
    }

    setSubmitting(true)
    setMessage(authMode === 'login' ? '正在登录...' : '正在注册...')
    try {
      if (authMode === 'login') {
        await signInWithPassword(email.trim(), password)
        setLoginOpen(false)
        resetForm()
      } else {
        const result = await signUpWithPassword(email.trim(), password)
        if (result.session) {
          setLoginOpen(false)
          resetForm()
        } else {
          setMessage('注册成功，请先查收邮件完成确认后再登录。')
          setAuthMode('login')
          setPassword('')
          setConfirmPassword('')
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '认证失败，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setMessage('')
    setAuthMode('login')
  }

  function closeLogin() {
    setLoginOpen(false)
    resetForm()
  }

  function switchMode(mode: AuthMode) {
    setAuthMode(mode)
    setPassword('')
    setConfirmPassword('')
    setMessage('')
  }

  async function handleSignOut() {
    await signOut()
    sessionRef.current = null
    setSession(null)
    setAccountOpen(false)
    setSyncStatus(clearObcpSyncAccount())
    clearCustomQuestionSyncAccount(loadCustomObcpQuestions().length)
    clearTroubleshootingCaseSyncAccount(loadCustomTroubleshootingCases().length)
    setTaxSyncStatus(clearTaxSyncAccount())
  }

  if (!isSupabaseConfigured) {
    return <StatusPill icon={CloudOff} label="本地模式" tone="slate" />
  }

  if (!session) {
    return (
      <>
        <button type="button" onClick={() => {
          if (syncStatus.state === 'failed' && syncStatus.lastError) {
            setMessage(syncStatus.lastError)
          }
          setLoginOpen(true)
        }} className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:border-ocean-300 hover:text-ocean-700 sm:px-3 sm:text-sm">
          <LogIn size={15} /><span className="hidden sm:inline">登录 / 同步</span><span className="sm:hidden">账号</span>
        </button>
        {loginOpen && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/45 p-3 sm:p-6">
            <div
              className="relative z-[101] max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-md border border-slate-200 bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-5"
              role="dialog"
              aria-modal="true"
              aria-label="账号登录与注册"
            >
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-base font-semibold text-ink">账号与 OBCP 云同步</h2><p className="mt-1 text-xs leading-5 text-slate-500">登录后可在 Web 与移动端共享刷题记录。</p></div>
                <button type="button" title="关闭" onClick={closeLogin} className="grid h-8 w-8 shrink-0 place-items-center text-slate-400 hover:text-slate-700"><X size={17} /></button>
              </div>

              <div className="mt-5 grid grid-cols-2 rounded-md bg-slate-100 p-1">
                <button type="button" onClick={() => switchMode('login')} className={`h-9 rounded text-sm font-semibold transition ${authMode === 'login' ? 'bg-white text-ocean-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>登录</button>
                <button type="button" onClick={() => switchMode('register')} className={`h-9 rounded text-sm font-semibold transition ${authMode === 'register' ? 'bg-white text-ocean-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>注册</button>
              </div>

              <div className="mt-4 space-y-4">
                <AuthField label="邮箱" type="email" value={email} autoComplete="email" placeholder="name@example.com" onChange={setEmail} />
                <AuthField label="密码" type="password" value={password} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="至少 6 位密码" onChange={setPassword} />
                {authMode === 'register' && (
                  <AuthField label="确认密码" type="password" value={confirmPassword} autoComplete="new-password" placeholder="再次输入密码" onChange={setConfirmPassword} />
                )}
              </div>
              {message && <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{message}</p>}
              <button
                type="button"
                disabled={submitting || !email.trim() || !password || (authMode === 'register' && !confirmPassword)}
                onClick={() => void submitCredentials()}
                className="mt-4 h-10 w-full rounded-md bg-ocean-600 text-sm font-semibold text-white hover:bg-ocean-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {submitting ? '请稍候...' : authMode === 'login' ? '登录并同步' : '注册账号'}
              </button>
            </div>
          </div>,
          document.body,
        )}
      </>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" title="账号与同步状态" onClick={() => setAccountOpen(true)} className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 hover:border-ocean-300 sm:px-3">
        <SyncIcon state={syncStatus.state} />
        <span className="hidden max-w-36 truncate lg:inline">{session.user.email ?? '已登录'}</span>
        <span>{syncLabel(syncStatus.state)}</span>
      </button>
      <button type="button" title="退出登录" onClick={() => void handleSignOut()} className="hidden h-9 w-9 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:grid"><LogOut size={15} /></button>
      {accountOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/45 p-3 sm:p-6">
          <div className="relative z-[101] max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-md border border-slate-200 bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-5" role="dialog" aria-modal="true" aria-label="账号与同步状态">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-base font-semibold text-ink">账号与同步状态</h2><p className="mt-1 break-all text-xs text-slate-500">{session.user.email ?? '已登录用户'}</p></div>
              <button type="button" title="关闭" onClick={() => setAccountOpen(false)} className="grid h-8 w-8 shrink-0 place-items-center text-slate-400 hover:text-slate-700"><X size={17} /></button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <StatusDetail label="当前状态" value={syncLabel(syncStatus.state)} />
              <StatusDetail label="最近同步" value={formatSyncTime(syncStatus.lastSyncAt)} />
            </div>

            {syncStatus.state === 'failed' && (
              <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-xs leading-5 text-rose-800">
                <p className="font-semibold">同步失败，已保留本地记录</p>
                <p className="mt-1">{syncStatus.lastError ?? '请检查网络后重新同步。'}</p>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button type="button" disabled={syncStatus.state === 'syncing'} onClick={() => void runSync()} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-ocean-600 px-3 text-sm font-semibold text-white hover:bg-ocean-700 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={16} className={syncStatus.state === 'syncing' ? 'animate-spin' : ''} />{syncStatus.state === 'syncing' ? '同步中' : '重新同步'}</button>
              <button type="button" onClick={() => void handleSignOut()} className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-700"><LogOut size={16} />退出登录</button>
            </div>

            <section className="mt-5 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-ink">同步诊断信息</h3>
              <dl className="mt-3 space-y-2 text-xs">
                <DiagnosticRow label="Supabase 配置" value={syncStatus.configured ? '已配置' : '未配置'} />
                <DiagnosticRow label="当前登录" value={syncStatus.loggedIn ? '是' : '否'} />
                <DiagnosticRow label="本地待同步记录" value={`${pendingCount} 条`} />
                <DiagnosticRow label="最近同步时间" value={formatSyncTime(syncStatus.lastSyncAt)} />
                <DiagnosticRow label="最近同步错误" value={syncStatus.lastError ?? '无'} />
              </dl>
            </section>

            <section className="mt-5 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">税务师同步诊断</h3>
                <button type="button" disabled={taxSyncStatus.state === 'syncing'} onClick={() => void runTaxSync()} className="text-xs font-semibold text-emerald-700 disabled:opacity-40">
                  {taxSyncStatus.state === 'syncing' ? '同步中' : '同步税务师数据'}
                </button>
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <DiagnosticRow label="Supabase 配置" value={taxSyncStatus.configured ? '已配置' : '未配置'} />
                <DiagnosticRow label="当前登录" value={taxSyncStatus.loggedIn ? '是' : '否'} />
                <DiagnosticRow label="本地税务师题数" value={`${taxSyncStatus.localQuestionCount} 题`} />
                <DiagnosticRow label="云端税务师题数" value={`${taxSyncStatus.cloudQuestionCount} 题`} />
                <DiagnosticRow label="本地答题记录" value={`${taxSyncStatus.localRecordCount} 条`} />
                <DiagnosticRow label="云端答题记录" value={`${taxSyncStatus.cloudRecordCount} 条`} />
                <DiagnosticRow label="最近税务师同步" value={formatSyncTime(taxSyncStatus.lastSyncAt)} />
                <DiagnosticRow label="最近税务师错误" value={taxSyncStatus.lastError ?? '无'} />
              </dl>
            </section>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function AuthField({
  label,
  type,
  value,
  autoComplete,
  placeholder,
  onChange,
}: {
  label: string
  type: 'email' | 'password'
  value: string
  autoComplete: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-ocean-400 focus:ring-2 focus:ring-ocean-100"
      />
    </label>
  )
}

function StatusPill({ icon: Icon, label, tone }: { icon: typeof CloudOff; label: string; tone: 'slate' }) {
  return <div className={`flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold ${tone === 'slate' ? 'text-slate-500' : ''}`}><Icon size={15} /><span className="hidden sm:inline">{label}</span></div>
}

function StatusDetail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 px-3 py-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-ink">{value}</p></div>
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><dt className="shrink-0 text-slate-500">{label}</dt><dd className="break-all text-right font-medium text-slate-700">{value}</dd></div>
}

function SyncIcon({ state }: { state: ObcpSyncState }) {
  if (state === 'syncing') return <RefreshCw size={15} className="animate-spin text-ocean-600" />
  if (state === 'synced') return <Check size={15} className="text-emerald-600" />
  if (state === 'failed') return <CloudOff size={15} className="text-rose-600" />
  return <Cloud size={15} className="text-slate-500" />
}

function syncLabel(state: ObcpSyncState) {
  if (state === 'syncing') return '同步中'
  if (state === 'synced') return '已同步'
  if (state === 'failed') return '同步失败'
  if (state === 'signedOut') return '未登录'
  return '本地模式'
}

function formatSyncTime(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN') : '尚未同步'
}
