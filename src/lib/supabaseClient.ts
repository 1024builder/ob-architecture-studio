export type SupabaseUser = {
  id: string
  email?: string
}

export type SupabaseSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: SupabaseUser
}

type RuntimeConfig = {
  supabaseUrl?: string
  supabaseAnonKey?: string
}

const runtimeConfig = (window as Window & {
  __OB_STUDIO_CONFIG__?: RuntimeConfig
}).__OB_STUDIO_CONFIG__
const url = normalizeConfigValue(runtimeConfig?.supabaseUrl)?.replace(/\/$/, '')
const anonKey = normalizeConfigValue(runtimeConfig?.supabaseAnonKey)

export const isSupabaseConfigured = Boolean(url && anonKey)
export const supabaseConfig = isSupabaseConfigured
  ? { url: url as string, anonKey: anonKey as string }
  : null

export class SupabaseRequestError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'SupabaseRequestError'
    this.status = status
  }
}

function normalizeConfigValue(value?: string) {
  const normalized = value?.trim()
  return normalized && !normalized.startsWith('%VITE_') ? normalized : undefined
}

export async function supabaseRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  if (!supabaseConfig) throw new SupabaseRequestError('Supabase 环境变量未配置。')
  let response: Response
  try {
    response = await fetch(`${supabaseConfig.url}${path}`, {
      ...options,
      headers: {
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${accessToken ?? supabaseConfig.anonKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch {
    throw new SupabaseRequestError('网络异常，无法连接 Supabase。')
  }
  if (!response.ok) {
    const message = await response.text()
    throw new SupabaseRequestError(
      message || `Supabase request failed: ${response.status}`,
      response.status,
    )
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return text ? JSON.parse(text) as T : undefined as T
}
