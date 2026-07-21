import { useQuery } from '@tanstack/react-query'
import { getProgramTradingDailyHistory, getProgramTradingDailyHistoryByRange } from '@/api/marketSummary'
import { stockHistoryKeys } from './queryKeys'
import { MARKET_DATA_CACHE } from './cacheConfig'

export function useProgramTradingDailyHistoryByRange(stockCode: string, from: string, to: string) {
  return useQuery({
    queryKey: stockHistoryKeys.programTradingDailyHistoryRange(stockCode, from, to),
    queryFn: () => getProgramTradingDailyHistoryByRange(stockCode, from, to),
    ...MARKET_DATA_CACHE,
  })
}

// 번들(market-summary)에는 일별 데이터가 없어 기본 종목이어도 항상 전용 조회.
export function useProgramTradingDailyHistory(stockCode: string | null) {
  const dedicated = useQuery({
    queryKey: stockHistoryKeys.programTradingDailyHistory(stockCode ?? ''),
    queryFn: () => getProgramTradingDailyHistory(stockCode as string),
    enabled: stockCode !== null,
    ...MARKET_DATA_CACHE,
  })

  return {
    stockCode: dedicated.data?.stockCode,
    items: dedicated.data?.items,
    isLoading: dedicated.isLoading,
    isError: dedicated.isError,
  }
}
