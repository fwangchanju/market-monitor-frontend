import { z } from 'zod'
import client from './client'
import {
  IndexContributionItemSchema,
  IntradayInvestorRankingItemSchema,
  IntradayTopItemSchema,
  MarketSummaryResponseSchema,
  ProgramTradingDailyItemSchema,
  ProgramTradingHistoryItemSchema,
  ProgramTradingRankingItemSchema,
  ShortSellingHistoryItemSchema,
  snapshotResponseSchema,
  stockHistoryResponseSchema,
  StockItemSchema,
  WatchStockItemSchema,
  type AmtQty,
  type MarketQuery,
  type IntradayInvestor,
  type IntradayRanking,
  type Market,
  type ProgramRanking,
} from '../types/api'

const watchStocksResponseSchema = z.array(WatchStockItemSchema)
const stocksResponseSchema = z.array(StockItemSchema)
const intradayTopResponseSchema = snapshotResponseSchema(IntradayTopItemSchema)
const intradayRankingsResponseSchema = snapshotResponseSchema(IntradayInvestorRankingItemSchema)
const programTradingRankingsResponseSchema = snapshotResponseSchema(ProgramTradingRankingItemSchema)
const indexContributionResponseSchema = snapshotResponseSchema(IndexContributionItemSchema)
const programTradingHistoryResponseSchema = stockHistoryResponseSchema(ProgramTradingHistoryItemSchema)
const programTradingDailyHistoryResponseSchema = stockHistoryResponseSchema(ProgramTradingDailyItemSchema)
const shortSellingHistoryResponseSchema = stockHistoryResponseSchema(ShortSellingHistoryItemSchema)
const sendDashboardResponseSchema = z.object({ sent: z.number() })

export const getMarketSummary = () =>
  client.get('/market-summary').then(r => MarketSummaryResponseSchema.parse(r.data))

export const getWatchStocks = () =>
  client.get('/watch-stocks').then(r => watchStocksResponseSchema.parse(r.data))

export const getStocks = () =>
  client.get('/stocks').then(r => stocksResponseSchema.parse(r.data))

export const getPrimaryStock = () =>
  client.get('/primary-stock').then(r => z.string().parse(r.data))

export const getIntradayTop = (
  market: MarketQuery,
  investor: IntradayInvestor,
  ranking: IntradayRanking,
) =>
  client
    .get('/intraday-top', {
      params: { market, investor, ranking },
    })
    .then(r => intradayTopResponseSchema.parse(r.data))

export const getIntradayRankings = (
  market: MarketQuery,
  investor: IntradayInvestor,
  ranking: IntradayRanking,
) =>
  client
    .get('/intraday-rankings', {
      params: { market, investor, ranking },
    })
    .then(r => intradayRankingsResponseSchema.parse(r.data))

export const getProgramTradingRankings = (
  ranking: ProgramRanking,
  market: MarketQuery,
  amtQty: AmtQty,
) =>
  client
    .get('/program-trading-rankings', {
      params: { ranking, market, amtQty },
    })
    .then(r => programTradingRankingsResponseSchema.parse(r.data))

export const getIndexContribution = (market: Market) =>
  client
    .get('/index-contribution', {
      params: { market },
    })
    .then(r => indexContributionResponseSchema.parse(r.data))

export const getProgramTradingHistory = (
  stockCode: string,
  from: string,
  to: string,
) =>
  client
    .get(
      `/stocks/${stockCode}/program-trading`,
      { params: { from, to } },
    )
    .then(r => programTradingHistoryResponseSchema.parse(r.data))

export const getProgramTradingDailyHistory = (
  stockCode: string,
  from: string,
  to: string,
) =>
  client
    .get(
      `/stocks/${stockCode}/program-trading/daily`,
      { params: { from, to } },
    )
    .then(r => programTradingDailyHistoryResponseSchema.parse(r.data))

export const getShortSellingHistory = (stockCode: string) =>
  client
    .get(
      `/stocks/${stockCode}/short-selling`,
    )
    .then(r => shortSellingHistoryResponseSchema.parse(r.data))

export const sendDashboard = () =>
  client.post('/send-dashboard').then(r => sendDashboardResponseSchema.parse(r.data))
