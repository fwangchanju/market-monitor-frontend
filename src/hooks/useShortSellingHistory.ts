import { useQuery } from '@tanstack/react-query'
import { getShortSellingHistory } from '../api/marketSummary'
import { stockHistoryKeys } from './queryKeys'
import { INFREQUENT_DATA_CACHE } from './cacheConfig'

export function useShortSellingHistory(stockCode: string) {
  return useQuery({
    queryKey: stockHistoryKeys.shortSellingHistory(stockCode),
    queryFn: () => getShortSellingHistory(stockCode),
    ...INFREQUENT_DATA_CACHE,
  })
}
