import { useQuery } from '@tanstack/react-query'
import { getProgramTradingHistory } from '../api/marketSummary'
import { stockHistoryKeys } from './queryKeys'
import { MARKET_DATA_CACHE } from './cacheConfig'

export function useProgramTradingHistory(stockCode: string, from: string, to: string) {
  return useQuery({
    queryKey: stockHistoryKeys.programTradingHistory(stockCode, from, to),
    queryFn: () => getProgramTradingHistory(stockCode, from, to),
    ...MARKET_DATA_CACHE,
  })
}
