import { useQuery } from '@tanstack/react-query'
import { getIndexContribution } from '../api/dashboard'
import { useMarketSummary } from './useMarketSummary'
import { marketSummaryKeys } from './queryKeys'
import { MARKET_DATA_CACHE } from './cacheConfig'
import type { Market } from '../types/api'

const DEFAULT_MARKET: Market = 'KOSPI'

export function useIndexContribution(market: Market) {
  const isDefault = market === DEFAULT_MARKET
  const marketSummary = useMarketSummary()
  const dedicated = useQuery({
    queryKey: marketSummaryKeys.indexContribution(market),
    queryFn: () => getIndexContribution(market),
    enabled: !isDefault,
    ...MARKET_DATA_CACHE,
  })

  return isDefault
    ? {
        items: marketSummary.data?.indexContributionHighlights.items,
        isLoading: marketSummary.isLoading,
        isError: marketSummary.isError,
      }
    : {
        items: dedicated.data?.items,
        isLoading: dedicated.isLoading,
        isError: dedicated.isError,
      }
}
