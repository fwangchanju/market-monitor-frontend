import axios, { type InternalAxiosRequestConfig } from 'axios'
import { AuthSessionResponseSchema } from '@/types/api'
import queryClient from './queryClient'
import { authKeys } from '@/hooks/queryKeys'

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

type RetriableConfig = InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean }

// 로그인 로직: 어떤 API든 401을 받으면 POST /auth/refresh를 한 번만 시도해서 재발급된 쿠키로
// 원래 요청을 재시도한다. refresh도 실패하면 로그아웃 상태로 간주하고(세션 캐시를 anonymous로
// 되돌린다) 원래 에러를 그대로 던진다 — 화면은 이후 로그아웃 UI로 자연히 전환된다.
// /auth/** 자체의 401(예: 세션 없음)은 재시도 대상이 아니다 — 무한 루프를 막는다.
let refreshPromise: Promise<unknown> | null = null

function markSessionAnonymous() {
  queryClient.setQueryData(authKeys.session(), { authenticated: false, userId: null, email: null, role: null })
}

client.interceptors.response.use(
  response => response,
  async error => {
    const config = error?.config as RetriableConfig | undefined
    const status = error?.response?.status
    const isAuthEndpoint = typeof config?.url === 'string' && config.url.includes('/auth/')

    if (status !== 401 || !config || config._retriedAfterRefresh || isAuthEndpoint) {
      return Promise.reject(error)
    }

    config._retriedAfterRefresh = true
    try {
      if (!refreshPromise) {
        refreshPromise = client.post('/auth/refresh').finally(() => {
          refreshPromise = null
        })
      }
      const refreshResponse = await refreshPromise
      const parsed = AuthSessionResponseSchema.safeParse((refreshResponse as { data: unknown }).data)
      if (parsed.success) queryClient.setQueryData(authKeys.session(), parsed.data)
      return await client(config)
    } catch {
      markSessionAnonymous()
      return Promise.reject(error)
    }
  },
)

export default client
