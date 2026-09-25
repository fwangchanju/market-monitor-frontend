import { useQuery } from '@tanstack/react-query'
import { getMarketMapScale } from '@/api/marketMap'
import { getCustomScale } from '@/api/custom'
import { marketMapKeys, customMarketMapKeys } from './queryKeys'
import { STATIC_REFERENCE_CACHE } from './cacheConfig'
import { useIsLoggedIn } from './useSession'

// 마켓맵 박스/범례 등락률 컬러 스케일 설정 — 처음 한 번만 시드용으로 쓰인다. 편집하는 동안은
// MarketMapCustomPage가 들고 있는 로컬 colorScaleDraft가 실제 렌더 소스라서, 개별
// create/update/delete(useMarketMapCustom) 호출 뒤에도 이 쿼리 캐시를 따로 갱신하지 않는다.
//
// 비로그인은 공개 기본값(GET /map/scale)을, 로그인 사용자는 본인 값(GET /custom/scale)을 받는다
// (가입/로그인 전환 지시서 4).
export function useMarketMapColorScale() {
  const isLoggedIn = useIsLoggedIn()
  return useQuery({
    queryKey: isLoggedIn ? customMarketMapKeys.scale() : marketMapKeys.scale(),
    queryFn: isLoggedIn ? getCustomScale : getMarketMapScale,
    ...STATIC_REFERENCE_CACHE,
  })
}
