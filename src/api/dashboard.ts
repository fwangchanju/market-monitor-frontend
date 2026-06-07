import client from './client'
import type {
  DashboardResponse,
  Exchange,
  IndexContributionItem,
  IntradayInvestorRankingItem,
  IntradayInvestorType,
  IntradayRankingType,
  IntradayTopItem,
  MarketType,
  ProgramRankingType,
  ProgramTradingDailyItem,
  ProgramTradingHistoryItem,
  ProgramTradingRankingItem,
  ShortSellingHistoryItem,
  SnapshotResponse,
  StockHistoryResponse,
  StockItem,
  WatchStockItem,
} from '../types/api'

export const getDashboard = () =>
  client.get<DashboardResponse>('/dashboard').then(r => r.data)

export const getWatchStocks = () =>
  client.get<WatchStockItem[]>('/watch-stocks').then(r => r.data)

export const getStocks = () =>
  client.get<StockItem[]>('/stocks').then(r => r.data)

export const getPrimaryStock = () =>
  client.get<string>('/primary-stock').then(r => r.data)

export const getIntradayTop = (
  market: Exchange,
  investor: IntradayInvestorType,
  ranking: IntradayRankingType,
) =>
  client
    .get<SnapshotResponse<IntradayTopItem>>('/intraday-top', {
      params: { market, investor, ranking },
    })
    .then(r => r.data)

export const getIntradayRankings = (
  market: Exchange,
  investor: IntradayInvestorType,
  ranking: IntradayRankingType,
) =>
  client
    .get<SnapshotResponse<IntradayInvestorRankingItem>>('/intraday-rankings', {
      params: { market, investor, ranking },
    })
    .then(r => r.data)

export const getProgramTradingRankings = (
  ranking: ProgramRankingType,
  market?: Exchange,
) =>
  client
    .get<SnapshotResponse<ProgramTradingRankingItem>>('/program-trading-rankings', {
      params: { ranking, ...(market ? { market } : {}) },
    })
    .then(r => r.data)

export const getIndexContribution = (market: MarketType) =>
  client
    .get<SnapshotResponse<IndexContributionItem>>('/index-contribution', {
      params: { market },
    })
    .then(r => r.data)

export const getProgramTradingHistory = (
  stockCode: string,
  from: string,
  to: string,
) =>
  client
    .get<StockHistoryResponse<ProgramTradingHistoryItem>>(
      `/stocks/${stockCode}/program-trading`,
      { params: { from, to } },
    )
    .then(r => r.data)

export const getProgramTradingDailyHistory = (
  stockCode: string,
  from: string,
  to: string,
) =>
  client
    .get<StockHistoryResponse<ProgramTradingDailyItem>>(
      `/stocks/${stockCode}/program-trading/daily`,
      { params: { from, to } },
    )
    .then(r => r.data)

export const getShortSellingHistory = (stockCode: string) =>
  client
    .get<StockHistoryResponse<ShortSellingHistoryItem>>(
      `/stocks/${stockCode}/short-selling`,
    )
    .then(r => r.data)

export const sendDashboard = () =>
  client.post<{ sent: number }>('/send-dashboard').then(r => r.data)
