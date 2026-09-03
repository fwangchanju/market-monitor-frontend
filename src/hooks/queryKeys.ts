import type {
  AmtQty,
  MarketQuery,
  IntradayInvestor,
  IntradayRanking,
  Market,
  ProgramRanking,
} from '@/types/api'

export const marketSummaryKeys = {
  all: ['market-summary'] as const,
  summary: () => [...marketSummaryKeys.all, 'summary'] as const,
  intradayTop: (market: MarketQuery, investor: IntradayInvestor, ranking: IntradayRanking, amtQty: AmtQty) =>
    [...marketSummaryKeys.all, 'intraday-top', market, investor, ranking, amtQty] as const,
  programTradingRankings: (ranking: ProgramRanking, market: MarketQuery, amtQty: AmtQty) =>
    [...marketSummaryKeys.all, 'program-trading-rankings', ranking, market, amtQty] as const,
  indexContribution: (market: Market) =>
    [...marketSummaryKeys.all, 'index-contribution', market] as const,
}

export const stockKeys = {
  all: ['stock'] as const,
  list: () => [...stockKeys.all, 'list'] as const,
}

export const stockHistoryKeys = {
  all: ['stock-history'] as const,
  shortSellingHistory: (stockCode: string) =>
    [...stockHistoryKeys.all, stockCode, 'short-selling'] as const,
  programTradingHistory: (stockCode: string) =>
    [...stockHistoryKeys.all, stockCode, 'program-trading'] as const,
  programTradingDailyHistory: (stockCode: string) =>
    [...stockHistoryKeys.all, stockCode, 'program-trading-daily'] as const,
}

export const watchStockKeys = {
  all: ['watch-stock'] as const,
  list: () => [...watchStockKeys.all, 'list'] as const,
}

export const marketMapKeys = {
  all: ['market-map'] as const,
  // exclude 필터링이 프론트로 옮겨오면서 백엔드는 항상 전체 트리를 내려주므로, isExclude는 쿼리에서 뺐다.
  map: (market: MarketQuery, isCustom: boolean) => [...marketMapKeys.all, 'map', market, isCustom] as const,
  scale: () => [...marketMapKeys.all, 'scale'] as const,
  valueTiers: () => [...marketMapKeys.all, 'value-tiers'] as const,
  categoryChangeRates: (market: MarketQuery, beforeMinutes: number) =>
    [...marketMapKeys.all, 'category-change-rates', market, beforeMinutes] as const,
}

export const allowedIpKeys = {
  all: ['allowed-ip'] as const,
  list: () => [...allowedIpKeys.all, 'list'] as const,
}

export const accessKeys = {
  all: ['access'] as const,
  adminStatus: () => [...accessKeys.all, 'admin-status'] as const,
}

export const marketMapAdminKeys = {
  all: ['market-map-admin'] as const,
  categories: () => [...marketMapAdminKeys.all, 'categories'] as const,
  deletePreview: (id: number) => [...marketMapAdminKeys.all, 'delete-preview', id] as const,
  versions: () => [...marketMapAdminKeys.all, 'versions'] as const,
  currentVersion: () => [...marketMapAdminKeys.all, 'current-version'] as const,
  stockCategories: () => [...marketMapAdminKeys.all, 'stock-categories'] as const,
}
