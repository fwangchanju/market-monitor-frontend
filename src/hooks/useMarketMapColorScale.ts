import { useQuery } from '@tanstack/react-query'
import { getMarketMapScale } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'
import { STATIC_REFERENCE_CACHE } from './cacheConfig'

// 마켓맵 박스/범례 등락률 컬러 스케일 설정 — 처음 한 번만 시드용으로 쓰인다. 어드민이 편집하는
// 동안은 MarketMapCustomPage가 들고 있는 로컬 colorScaleDraft가 실제 렌더 소스라서, 개별
// create/update/delete(useMarketMapAdmin) 호출 뒤에도 이 쿼리 캐시를 따로 갱신하지 않는다.
export function useMarketMapColorScale() {
  return useQuery({
    queryKey: marketMapKeys.scale(),
    queryFn: getMarketMapScale,
    ...STATIC_REFERENCE_CACHE,
  })
}
