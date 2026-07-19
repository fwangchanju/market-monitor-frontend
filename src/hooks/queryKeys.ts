import type {
  Exchange,
  IntradayInvestorType,
  IntradayRankingType,
  MarketType,
  ProgramRankingType,
} from '../types/api'

export const marketSummaryKeys = {
  all: ['market-summary'] as const,
  summary: () => [...marketSummaryKeys.all, 'summary'] as const,
  intradayTop: (market: Exchange, investor: IntradayInvestorType, ranking: IntradayRankingType) =>
    [...marketSummaryKeys.all, 'intraday-top', market, investor, ranking] as const,
  intradayRankings: (market: Exchange, investor: IntradayInvestorType, ranking: IntradayRankingType) =>
    [...marketSummaryKeys.all, 'intraday-rankings', market, investor, ranking] as const,
  programTradingRankings: (ranking: ProgramRankingType, market?: Exchange) =>
    [...marketSummaryKeys.all, 'program-trading-rankings', ranking, market ?? 'ALL'] as const,
  indexContribution: (market: MarketType) =>
    [...marketSummaryKeys.all, 'index-contribution', market] as const,
}

export const stockKeys = {
  all: ['stock'] as const,
  list: () => [...stockKeys.all, 'list'] as const,
  shortSellingHistory: (stockCode: string) =>
    [...stockKeys.all, stockCode, 'short-selling'] as const,
  programTradingHistory: (stockCode: string, from: string, to: string) =>
    [...stockKeys.all, stockCode, 'program-trading', from, to] as const,
  programTradingDailyHistory: (stockCode: string, from: string, to: string) =>
    [...stockKeys.all, stockCode, 'program-trading-daily', from, to] as const,
}
