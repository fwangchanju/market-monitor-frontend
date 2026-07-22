import { useQuery } from '@tanstack/react-query'
import { getProgramTradingRankings } from '@/api/marketSummary'
import { useMarketSummary } from './useMarketSummary'
import { marketSummaryKeys } from './queryKeys'
import { MARKET_DATA_CACHE } from './cacheConfig'
import type { AmtQty, MarketQuery, ProgramRanking } from '@/types/api'

const DEFAULT_RANKING: ProgramRanking = 'NET_BUY'
const DEFAULT_MARKET: MarketQuery = 'KOSPI'
const DEFAULT_AMT_QTY: AmtQty = 'AMOUNT'

export function useProgramTradingRankings(ranking: ProgramRanking, market: MarketQuery, amtQty: AmtQty) {
  const isDefault = ranking === DEFAULT_RANKING && market === DEFAULT_MARKET && amtQty === DEFAULT_AMT_QTY
  const marketSummary = useMarketSummary()
  const dedicated = useQuery({
    queryKey: marketSummaryKeys.programTradingRankings(ranking, market, amtQty),
    queryFn: () => getProgramTradingRankings(ranking, market, amtQty),
    enabled: !isDefault,
    ...MARKET_DATA_CACHE,
  })

  return isDefault
    ? {
        items: marketSummary.data?.programTradingHighlights.items,
        snapshotTime: marketSummary.data?.programTradingHighlights.snapshotTime,
        isLoading: marketSummary.isLoading,
        isError: marketSummary.isError,
      }
    : {
        items: dedicated.data?.items,
        snapshotTime: dedicated.data?.snapshotTime,
        isLoading: dedicated.isLoading,
        isError: dedicated.isError,
      }
}
