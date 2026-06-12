import {
  isSupabaseConfigured,
  supabaseConfig,
  supabaseRequest,
  type SupabaseSession,
  type SupabaseUser,
} from '../lib/supabaseClient'

const AUTH_STORAGE_KEY = 'ob-architecture-studio:supabase-session'
export const AUTH_STATE_CHANGED_EVENT = 'ob-architecture-studio:auth-state-changed'

type AuthTokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  user: SupabaseUser
}

type SignUpResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  user: SupabaseUser
}

export type SignUpResult = {
  session: SupabaseSession | null
  requiresEmailConfirmation: boolean
}

export function getStoredSession(): SupabaseSession | null {
  if (!isSupabaseConfigured) return null
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? JSON.parse(raw) as SupabaseSession : null
  } catch {
    return null
  }
}

export async function getActiveSession() {
  const callbackSession = readSessionFromCallback()
  if (callbackSession) {
    saveSession(callbackSession)
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${window.location.search}#/dashboard`,
    )
    return callbackSession
  }

  const session = getStoredSession()
  if (!session) return null
  if (session.expiresAt > Date.now() + 60_000) return session
  return refreshSession(session.refreshToken)
}

export async function sendMagicLink(email: string) {
  if (!supabaseConfig) throw new Error('未配置 Supabase，当前为本地模式。')
  await supabaseRequest('/auth/v1/otp', {
    method: 'POST',
    body: JSON.stringify({
      email,
      create_user: true,
      email_redirect_to: `${window.location.origin}${window.location.pathname}`,
    }),
  })
}

export async function signInWithPassword(email: string, password: string) {
  try {
    const response = await supabaseRequest<AuthTokenResponse>(
      '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    )
    const session = tokenResponseToSession(response)
    saveSession(session)
    return session
  } catch (error) {
    throw new Error(getFriendlyAuthError(error, 'login'))
  }
}

export async function signUpWithPassword(email: string, password: string): Promise<SignUpResult> {
  try {
    const response = await supabaseRequest<SignUpResponse>(
      '/auth/v1/signup',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    )
    if (response.access_token && response.refresh_token && response.expires_in) {
      const session = tokenResponseToSession({
        access_token: response.access_token,
        refresh_token: response.refresh_token,
        expires_in: response.expires_in,
        user: response.user,
      })
      saveSession(session)
      return { session, requiresEmailConfirmation: false }
    }
    return { session: null, requiresEmailConfirmation: true }
  } catch (error) {
    throw new Error(getFriendlyAuthError(error, 'signup'))
  }
}

export async function signOut() {
  const session = getStoredSession()
  if (session) {
    try {
      await supabaseRequest('/auth/v1/logout', { method: 'POST' }, session.accessToken)
    } catch {
      // Local sign-out remains available if the network request fails.
    }
  }
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  notifyAuthChanged()
}

export function clearExpiredSession() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  notifyAuthChanged()
}

async function refreshSession(refreshToken: string) {
  try {
    const response = await supabaseRequest<AuthTokenResponse>(
      '/auth/v1/token?grant_type=refresh_token',
      { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) },
    )
    const session = tokenResponseToSession(response)
    saveSession(session)
    return session
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    notifyAuthChanged()
    return null
  }
}

function readSessionFromCallback(): SupabaseSession | null {
  const hashParams = new URLSearchParams(window.location.hash.slice(1))
  const queryParams = new URLSearchParams(window.location.search)
  const accessToken = hashParams.get('access_token') ?? queryParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token') ?? queryParams.get('refresh_token')
  const expiresIn = Number(hashParams.get('expires_in') ?? queryParams.get('expires_in') ?? 3600)
  if (!accessToken || !refreshToken) return null

  const payload = parseJwt(accessToken)
  if (typeof payload?.sub !== 'string') return null
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    user: { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined },
  }
}

function tokenResponseToSession(response: AuthTokenResponse): SupabaseSession {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: Date.now() + response.expires_in * 1000,
    user: response.user,
  }
}

function saveSession(session: SupabaseSession) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  notifyAuthChanged()
}

function notifyAuthChanged() {
  window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGED_EVENT))
}

function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(atob(payload).split('').map((character) =>
      `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`,
    ).join(''))) as Record<string, unknown>
  } catch {
    return null
  }
}

function getFriendlyAuthError(error: unknown, action: 'login' | 'signup') {
  const rawMessage = error instanceof Error ? error.message : String(error)
  let message = rawMessage
  try {
    const parsed = JSON.parse(rawMessage) as { msg?: string; message?: string; error_description?: string; error_code?: string }
    message = parsed.msg ?? parsed.message ?? parsed.error_description ?? parsed.error_code ?? rawMessage
  } catch {
    // Supabase may return plain text instead of JSON.
  }

  const normalized = message.toLocaleLowerCase()
  if (normalized.includes('invalid login credentials')) return '邮箱或密码错误，请检查后重试。'
  if (normalized.includes('email not confirmed')) return '邮箱尚未确认，请先查收确认邮件。'
  if (normalized.includes('user not found')) return '用户不存在，请先注册账号。'
  if (normalized.includes('password') && (normalized.includes('short') || normalized.includes('characters'))) {
    return '密码长度不足，请至少输入 6 位密码。'
  }
  if (normalized.includes('already registered') || normalized.includes('already been registered')) {
    return '该邮箱已注册，请直接登录。'
  }
  if (normalized.includes('rate limit')) return '操作过于频繁，请稍后再试。'
  return action === 'login' ? '登录失败，请检查邮箱、密码或网络连接。' : '注册失败，请检查填写信息后重试。'
}
