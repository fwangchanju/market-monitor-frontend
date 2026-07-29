import { useQuery } from '@tanstack/react-query'
import { getProgramTradingHistory } from '@/api/marketSummary'
import { useMarketSummary } from './useMarketSummary'
import { stockHistoryKeys } from './queryKeys'
import { MARKET_DATA_CACHE } from './cacheConfig'

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
