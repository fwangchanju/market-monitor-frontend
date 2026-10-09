import { useQuery } from '@tanstack/react-query'
import { getMarketMap, getStockCatalog, type ChangeRateBasis } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'
import { MARKET_DATA_CACHE, STATIC_REFERENCE_CACHE } from './cacheConfig'
import type { MarketQuery } from '@/types/api'
import type { ClassificationSource } from '@/utils/taxonomyNames'

export function useMarketMap(
  market: MarketQuery,
  source: ClassificationSource,
  nxtOnly: boolean,
  options?: { enabled?: boolean; basis?: ChangeRateBasis },
) {
  const basis = options?.basis ?? 'daily'
  return useQuery({
    queryKey: marketMapKeys.map(market, source, nxtOnly, basis),
    queryFn: () => getMarketMap(market, source, undefined, nxtOnly, basis),
    enabled: options?.enabled ?? true,
    ...MARKET_DATA_CACHE,
  })
}

// 로그인 없이 읽는 종목 공통 정보 — 읽기 전용 시트가 NXT 여부·시장·거래소 업종명을 얻는다.
export function useStockCatalog(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marketMapKeys.stockCatalog(),
    queryFn: getStockCatalog,
    enabled: options?.enabled ?? true,
    ...STATIC_REFERENCE_CACHE,
  })
}
