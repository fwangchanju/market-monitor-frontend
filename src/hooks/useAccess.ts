import { useQuery } from '@tanstack/react-query'
import { getAdminStatus } from '@/api/access'
import { accessKeys } from './queryKeys'
import { STATIC_REFERENCE_CACHE } from './cacheConfig'

// 확인 전(로딩 중)이나 요청 실패 시에는 data가 undefined라 자연스럽게 false로 떨어진다 —
// admin 여부가 불확실한 동안은 항상 "admin 아님"으로 취급해서 일반 유저에게 admin 전용 UI가
// 잠깐이라도 노출되지 않게 한다.
export function useIsAdmin(): boolean {
  const { data } = useQuery({
    queryKey: accessKeys.adminStatus(),
    queryFn: getAdminStatus,
    ...STATIC_REFERENCE_CACHE,
  })
  return data ?? false
}
