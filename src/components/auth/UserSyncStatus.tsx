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
import {
  AUTH_STATE_CHANGED_EVENT,
  getActiveSession,
  signInWithPassword,
  signOut,
  signUpWithPassword,
} from '../../services/authService'
import { syncObcpData } from '../../services/obcpSyncService'
import { OBCP_LOCAL_DATA_CHANGED_EVENT } from '../../utils/obcpStorage'

type SyncState = 'local' | 'signedOut' | 'syncing' | 'synced' | 'failed'
type AuthMode = 'login' | 'register'

export function UserSyncStatus() {
  const [session, setSession] = useState<SupabaseSession | null>(null)
  const [syncState, setSyncState] = useState<SyncState>(isSupabaseConfigured ? 'signedOut' : 'local')
  const [loginOpen, setLoginOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const syncTimer = useRef<number>()
  const sessionRef = useRef<SupabaseSession | null>(null)

  useEffect(() => {
    let active = true

    async function initialize() {
      const nextSession = await getActiveSession()
      if (!active) return
      sessionRef.current = nextSession
      setSession(nextSession)
      if (nextSession) void runSync(nextSession)
      else setSyncState(isSupabaseConfigured ? 'signedOut' : 'local')
    }

    function handleAuthChange() {
      void initialize()
    }

    function handleLocalChange() {
      if (!sessionRef.current) return
      window.clearTimeout(syncTimer.current)
      syncTimer.current = window.setTimeout(() => void runSync(sessionRef.current), 900)
    }

    void initialize()
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthChange)
    window.addEventListener(OBCP_LOCAL_DATA_CHANGED_EVENT, handleLocalChange)
    return () => {
      active = false
      window.clearTimeout(syncTimer.current)
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthChange)
      window.removeEventListener(OBCP_LOCAL_DATA_CHANGED_EVENT, handleLocalChange)
    }
  }, [])

  useEffect(() => {
    if (!loginOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [loginOpen])

  async function runSync(activeSession = sessionRef.current) {
    if (!activeSession) return
    setSyncState('syncing')
    try {
      await syncObcpData(activeSession)
      setSyncState('synced')
    } catch {
      setSyncState('failed')
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
    setSyncState('signedOut')
  }

  if (!isSupabaseConfigured) {
    return <StatusPill icon={CloudOff} label="本地模式" tone="slate" />
  }

  if (!session) {
    return (
      <>
        <button type="button" onClick={() => setLoginOpen(true)} className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:border-ocean-300 hover:text-ocean-700 sm:px-3 sm:text-sm">
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
      <button type="button" title={syncState === 'failed' ? '同步失败，已保留本地记录' : '手动同步'} onClick={() => void runSync()} className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 hover:border-ocean-300 sm:px-3">
        <SyncIcon state={syncState} />
        <span className="hidden max-w-36 truncate lg:inline">{session.user.email ?? '已登录'}</span>
        <span>{syncLabel(syncState)}</span>
      </button>
      <button type="button" title="退出登录" onClick={() => void handleSignOut()} className="grid h-9 w-9 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"><LogOut size={15} /></button>
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

function SyncIcon({ state }: { state: SyncState }) {
  if (state === 'syncing') return <RefreshCw size={15} className="animate-spin text-ocean-600" />
  if (state === 'synced') return <Check size={15} className="text-emerald-600" />
  if (state === 'failed') return <CloudOff size={15} className="text-rose-600" />
  return <Cloud size={15} className="text-slate-500" />
}

function syncLabel(state: SyncState) {
  if (state === 'syncing') return '同步中'
  if (state === 'synced') return '已同步'
  if (state === 'failed') return '同步失败'
  if (state === 'signedOut') return '未登录'
  return '本地模式'
}
