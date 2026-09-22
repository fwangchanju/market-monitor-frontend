import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { usePersistedState } from './usePersistedState'
import { marketFromRouteSegment } from '@/utils/marketRoute'
import type { MarketQuery } from '@/types/api'

function toValidMarketQuery(value: string | null): MarketQuery | null {
  return value === 'KOSPI' || value === 'KOSDAQ' || value === 'ALL_STOCK' ? value : null
}

// 마켓 우선순위: ?market= 쿼리(옛 캡처 URL 호환) > 경로 세그먼트(/map|sector/kospi 등) > 세션스토리지
// 저장값(경로에 마켓이 없는 /map, /sector에서 마지막으로 본 마켓을 기억) > 기본값.
//
// usePersistedState(key, routeMarket ?? defaultMarket)처럼 우선순위를 initialValue 하나로 욱여넣으면
// 안 된다 — sessionStorage에 저장값이 있으면 그 값이 initialValue를 이기므로(usePersistedState.ts:17-20)
// 브라우저에서는 저장값이 경로를 눌러버린다. 그래서 저장 상태(storedMarket)와 이번 렌더가 실제로 쓰는
// 값(market)을 분리하고, 우선순위 계산 자체는 저장값을 거치지 않고 매 렌더 순수하게 다시 한다.
export function useRouteAwareMarket(
  storageKey: string,
  defaultMarket: MarketQuery,
): [MarketQuery, (market: MarketQuery) => void] {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const [storedMarket, setStoredMarket] = usePersistedState<MarketQuery>(storageKey, defaultMarket)

  const routeMarket = marketFromRouteSegment(pathname.split('/')[2])
  const market = toValidMarketQuery(searchParams.get('market')) ?? routeMarket ?? storedMarket

  // 경로/쿼리로 정해진 마켓을 저장해둬야, 마켓 세그먼트가 없는 다음 방문(/sector, /map)에서 폴백으로 쓸 수 있다.
  useEffect(() => {
    if (market !== storedMarket) setStoredMarket(market)
  }, [market, storedMarket, setStoredMarket])

  return [market, setStoredMarket]
}
