import { useQuery } from '@tanstack/react-query'
import { getShortSellingHistory } from '@/api/marketSummary'
import { useMarketSummary } from './useMarketSummary'
import { stockHistoryKeys } from './queryKeys'
import { INFREQUENT_DATA_CACHE } from './cacheConfig'

export function useShortSellingHistory(stockCode: string | null) {
  const isDefault = stockCode === null
  const marketSummary = useMarketSummary()
  const dedicated = useQuery({
    queryKey: stockHistoryKeys.shortSellingHistory(stockCode ?? ''),
    queryFn: () => getShortSellingHistory(stockCode as string),
    enabled: !isDefault,
    ...INFREQUENT_DATA_CACHE,
  })

  return isDefault
    ? {
        stockCode: marketSummary.data?.mainShortSellingHistory.stockCode,
        items: marketSummary.data?.mainShortSellingHistory.items,
        isLoading: marketSummary.isLoading,
        isError: marketSummary.isError,
      }
    : {
        stockCode: dedicated.data?.stockCode,
        items: dedicated.data?.items,
        isLoading: dedicated.isLoading,
        isError: dedicated.isError,
      }
}
