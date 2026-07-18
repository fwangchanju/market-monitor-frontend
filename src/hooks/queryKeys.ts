import type {
  Exchange,
  IntradayInvestorType,
  IntradayRankingType,
  MarketType,
  ProgramRankingType,
} from '../types/api'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  stocks: () => [...dashboardKeys.all, 'stocks'] as const,
  intradayTop: (market: Exchange, investor: IntradayInvestorType, ranking: IntradayRankingType) =>
    [...dashboardKeys.all, 'intraday-top', market, investor, ranking] as const,
  intradayRankings: (market: Exchange, investor: IntradayInvestorType, ranking: IntradayRankingType) =>
    [...dashboardKeys.all, 'intraday-rankings', market, investor, ranking] as const,
  programTradingRankings: (ranking: ProgramRankingType, market?: Exchange) =>
    [...dashboardKeys.all, 'program-trading-rankings', ranking, market ?? 'ALL'] as const,
  indexContribution: (market: MarketType) =>
    [...dashboardKeys.all, 'index-contribution', market] as const,
}

export const stockKeys = {
  all: ['stock'] as const,
  shortSellingHistory: (stockCode: string) =>
    [...stockKeys.all, stockCode, 'short-selling'] as const,
  programTradingHistory: (stockCode: string, from: string, to: string) =>
    [...stockKeys.all, stockCode, 'program-trading', from, to] as const,
  programTradingDailyHistory: (stockCode: string, from: string, to: string) =>
    [...stockKeys.all, stockCode, 'program-trading-daily', from, to] as const,
}
