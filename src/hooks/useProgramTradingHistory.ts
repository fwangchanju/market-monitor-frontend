import { useQuery } from '@tanstack/react-query'
import { getProgramTradingHistory, getProgramTradingHistoryByRange } from '@/api/marketSummary'
import { useMarketSummary } from './useMarketSummary'
import { stockHistoryKeys } from './queryKeys'
import { MARKET_DATA_CACHE } from './cacheConfig'

export function useProgramTradingHistoryByRange(stockCode: string, from: string, to: string) {
  return useQuery({
    queryKey: stockHistoryKeys.programTradingHistoryRange(stockCode, from, to),
    queryFn: () => getProgramTradingHistoryByRange(stockCode, from, to),
    ...MARKET_DATA_CACHE,
  })
}

export function useProgramTradingHistory(stockCode: string | null) {
  const isDefault = stockCode === null
  const marketSummary = useMarketSummary()
  const dedicated = useQuery({
    queryKey: stockHistoryKeys.programTradingHistory(stockCode ?? ''),
    queryFn: () => getProgramTradingHistory(stockCode as string),
    enabled: !isDefault,
    ...MARKET_DATA_CACHE,
  })

  return isDefault
    ? {
        stockCode: marketSummary.data?.mainProgramTradingHistory.stockCode,
        snapshotTime: marketSummary.data?.mainProgramTradingHistory.snapshotTime,
        items: marketSummary.data?.mainProgramTradingHistory.items,
        isLoading: marketSummary.isLoading,
        isError: marketSummary.isError,
      }
    : {
        stockCode: dedicated.data?.stockCode,
        snapshotTime: dedicated.data?.snapshotTime,
        items: dedicated.data?.items,
        isLoading: dedicated.isLoading,
        isError: dedicated.isError,
      }
}
