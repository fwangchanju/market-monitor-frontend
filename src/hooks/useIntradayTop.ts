import { useQuery } from '@tanstack/react-query'
import { getIntradayTop } from '@/api/marketSummary'
import { useMarketSummary } from './useMarketSummary'
import { marketSummaryKeys } from './queryKeys'
import { MARKET_DATA_CACHE } from './cacheConfig'
import type { AmtQty, MarketQuery, IntradayInvestor, IntradayRanking } from '@/types/api'

const DEFAULT_MARKET: MarketQuery = 'KOSPI'
const DEFAULT_INVESTOR: IntradayInvestor = 'FOREIGNER'
const DEFAULT_RANKING: IntradayRanking = 'NET_BUY'
const DEFAULT_AMT_QTY: AmtQty = 'AMOUNT'

export function useIntradayTop(
  market: MarketQuery,
  investor: IntradayInvestor,
  ranking: IntradayRanking,
  amtQty: AmtQty,
) {
  const isDefault =
    market === DEFAULT_MARKET &&
    investor === DEFAULT_INVESTOR &&
    ranking === DEFAULT_RANKING &&
    amtQty === DEFAULT_AMT_QTY
  const marketSummary = useMarketSummary()
  const dedicated = useQuery({
    queryKey: marketSummaryKeys.intradayTop(market, investor, ranking, amtQty),
    queryFn: () => getIntradayTop(market, investor, ranking, amtQty),
    enabled: !isDefault,
    ...MARKET_DATA_CACHE,
  })

  return isDefault
    ? {
        items: marketSummary.data?.intradayTopRankings.items,
        snapshotTime: marketSummary.data?.intradayTopRankings.snapshotTime,
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
