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
  programTradingHistoryRange: (stockCode: string, from: string, to: string) =>
    [...stockHistoryKeys.all, stockCode, 'program-trading', from, to] as const,
  programTradingDailyHistory: (stockCode: string) =>
    [...stockHistoryKeys.all, stockCode, 'program-trading-daily'] as const,
  programTradingDailyHistoryRange: (stockCode: string, from: string, to: string) =>
    [...stockHistoryKeys.all, stockCode, 'program-trading-daily', from, to] as const,
}

export const watchStockKeys = {
  all: ['watch-stock'] as const,
  list: () => [...watchStockKeys.all, 'list'] as const,
}

export const marketMapKeys = {
  all: ['market-map'] as const,
  map: (market: Market, isExclude: boolean) => [...marketMapKeys.all, 'map', market, isExclude] as const,
  excludedStocks: () => [...marketMapKeys.all, 'excluded-stocks'] as const,
  categories: () => [...marketMapKeys.all, 'categories'] as const,
}
