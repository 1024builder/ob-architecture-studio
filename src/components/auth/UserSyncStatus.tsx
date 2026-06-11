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
import { isSupabaseConfigured, type SupabaseSession } from '../../lib/supabaseClient'
import {
  AUTH_STATE_CHANGED_EVENT,
  getActiveSession,
  sendMagicLink,
  signOut,
} from '../../services/authService'
import { syncObcpData } from '../../services/obcpSyncService'
import { OBCP_LOCAL_DATA_CHANGED_EVENT } from '../../utils/obcpStorage'

type SyncState = 'local' | 'signedOut' | 'syncing' | 'synced' | 'failed'

export function UserSyncStatus() {
  const [session, setSession] = useState<SupabaseSession | null>(null)
  const [syncState, setSyncState] = useState<SyncState>(isSupabaseConfigured ? 'signedOut' : 'local')
  const [loginOpen, setLoginOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
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

  async function submitMagicLink() {
    if (!email.trim()) return
    setMessage('正在发送登录链接...')
    try {
      await sendMagicLink(email.trim())
      setMessage('登录链接已发送，请检查邮箱并在当前设备打开。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登录链接发送失败。')
    }
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
          <LogIn size={15} /><span className="hidden sm:inline">登录 / 同步</span><span className="sm:hidden">登录</span>
        </button>
        {loginOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="邮箱登录">
            <div className="w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-base font-semibold text-ink">登录并同步 OBCP 数据</h2><p className="mt-1 text-xs leading-5 text-slate-500">输入邮箱后，Supabase 将发送 Magic Link。</p></div>
                <button type="button" title="关闭" onClick={() => setLoginOpen(false)} className="grid h-8 w-8 place-items-center text-slate-400 hover:text-slate-700"><X size={17} /></button>
              </div>
              <label className="mt-5 block"><span className="text-xs font-semibold text-slate-600">邮箱</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-ocean-400 focus:ring-2 focus:ring-ocean-100" /></label>
              {message && <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{message}</p>}
              <button type="button" disabled={!email.trim()} onClick={() => void submitMagicLink()} className="mt-4 h-10 w-full rounded-md bg-ocean-600 text-sm font-semibold text-white hover:bg-ocean-700 disabled:cursor-not-allowed disabled:opacity-45">发送 Magic Link</button>
            </div>
          </div>
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
