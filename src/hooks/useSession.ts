import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSession, logout } from '@/api/auth'
import { authKeys } from './queryKeys'
import { STATIC_REFERENCE_CACHE } from './cacheConfig'
import { cancelPendingPreferenceSave } from './useCustomPreferences'
import type { AuthSessionResponse } from '@/types/api'

const LAST_USER_ID_STORAGE_KEY = 'auth.lastUserId'
// 계정마다 뜻이 달라지는 커스텀 모드 관련 저장값 — 로그아웃/계정 전환 시 이전 계정의 값이 새 계정
// 화면에 잠깐이라도 새어나가지 않도록 지운다. marketMap.excludedCategoryNames는 sectorId가 계정마다
// 다른 섹터를 가리킬 수 있어 특히 중요하다.
const CUSTOM_MODE_STORAGE_KEYS = ['marketMap.isCustom', 'marketMap.excludedCategoryNames']

function clearCustomModeStorage() {
  for (const key of CUSTOM_MODE_STORAGE_KEYS) {
    try {
      sessionStorage.removeItem(key)
    } catch {
      // 프라이빗 모드 등으로 접근이 막혀도 화면 동작 자체는 계속되게 조용히 무시
    }
  }
}

// 세션 응답이 도착할 때마다, 마지막으로 본 사용자와 다르면(로그아웃 → 익명, 다른 계정으로 재로그인)
// 계정별로 뜻이 달라지는 저장값을 지운다. 로그아웃은 useLogout이 즉시 처리하지만, 새로고침/직접
// URL 진입처럼 세션이 나중에 확인되는 경로에서도 동일하게 걸리도록 여기서 한 번 더 보정한다.
function reconcileCustomModeStorage(session: AuthSessionResponse) {
  try {
    const stored = sessionStorage.getItem(LAST_USER_ID_STORAGE_KEY)
    const current = session.authenticated ? String(session.userId) : null
    if (stored === current) return
    clearCustomModeStorage()
    if (current === null) sessionStorage.removeItem(LAST_USER_ID_STORAGE_KEY)
    else sessionStorage.setItem(LAST_USER_ID_STORAGE_KEY, current)
  } catch {
    // 위와 동일 — 저장소 접근 실패는 무시
  }
}

export function useSession() {
  return useQuery({
    queryKey: authKeys.session(),
    queryFn: async () => {
      const session = await getSession()
      reconcileCustomModeStorage(session)
      return session
    },
    ...STATIC_REFERENCE_CACHE,
    retry: false,
  })
}

export function useIsLoggedIn(): boolean {
  const { data } = useSession()
  return data?.authenticated ?? false
}

const ANONYMOUS_SESSION: AuthSessionResponse = { authenticated: false, userId: null, email: null, role: null }

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // 저장 대기 중인 preferences 디바운스 저장을 취소한 뒤(다음 로그인 사용자에게 새어나가지 않도록)
      // 사용자별 데이터가 남지 않도록 캐시 전체를 비운다 — 이전 계정 화면이 잠깐이라도 보이지 않게.
      cancelPendingPreferenceSave()
      queryClient.clear()
      queryClient.setQueryData(authKeys.session(), ANONYMOUS_SESSION)
      clearCustomModeStorage()
      try {
        sessionStorage.removeItem(LAST_USER_ID_STORAGE_KEY)
      } catch {
        // 무시
      }
    },
  })
}
