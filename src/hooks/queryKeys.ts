import type {
  AmtQty,
  MarketQuery,
  IntradayInvestor,
  IntradayRanking,
  Market,
  ProgramRanking,
} from '@/types/api'

export const marketSummaryKeys = {
  all: ['summary'] as const,
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
  all: ['map'] as const,
  // exclude 필터링이 프론트로 옮겨오면서 백엔드는 항상 전체 트리를 내려주므로, isExclude는 쿼리에서 뺐다.
  map: (market: MarketQuery, isCustom: boolean) => [...marketMapKeys.all, 'map', market, isCustom] as const,
  scale: () => [...marketMapKeys.all, 'scale'] as const,
  valueTiers: () => [...marketMapKeys.all, 'value-tiers'] as const,
  // 섹터 페이지의 now·before 쌍 쿼리 키 — now.snapshotTime이 바뀌면(새 tick) 새 쌍을 받는다.
  // market·isCustom·beforeMinutes가 바뀌면(사용자 조작) 직전 쌍을 placeholder로 쓰지 않는다.
  sectorPair: (market: MarketQuery, isCustom: boolean, beforeMinutes: number, nowSnapshotTime: string | null) =>
    [...marketMapKeys.all, 'sectorPair', market, isCustom, beforeMinutes, nowSnapshotTime] as const,
}

export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
}

export const customMarketMapKeys = {
  all: ['custom-market-map'] as const,
  sectors: () => [...customMarketMapKeys.all, 'sectors'] as const,
  sectorDeletePreview: (id: number) => [...customMarketMapKeys.all, 'sector-delete-preview', id] as const,
  snapshots: () => [...customMarketMapKeys.all, 'snapshots'] as const,
  currentSnapshot: () => [...customMarketMapKeys.all, 'current-snapshot'] as const,
  stockSectors: () => [...customMarketMapKeys.all, 'stock-sectors'] as const,
  scale: () => [...customMarketMapKeys.all, 'scale'] as const,
  valueTiers: () => [...customMarketMapKeys.all, 'value-tiers'] as const,
}

export const customPreferenceKeys = {
  all: ['custom-preferences'] as const,
  preferences: () => [...customPreferenceKeys.all, 'preferences'] as const,
}
