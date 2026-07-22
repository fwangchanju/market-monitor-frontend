import { z } from 'zod'
import client from './client'
import {
  IndexContributionItemSchema,
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
} from '@/types/api'

const watchStocksResponseSchema = z.array(WatchStockItemSchema)
const stocksResponseSchema = z.array(StockItemSchema)
const intradayTopResponseSchema = snapshotResponseSchema(IntradayTopItemSchema)
const programTradingRankingsResponseSchema = snapshotResponseSchema(ProgramTradingRankingItemSchema)
const indexContributionResponseSchema = snapshotResponseSchema(IndexContributionItemSchema)
const programTradingHistoryResponseSchema = stockHistoryResponseSchema(ProgramTradingHistoryItemSchema)
const programTradingDailyHistoryResponseSchema = stockHistoryResponseSchema(ProgramTradingDailyItemSchema)
const shortSellingHistoryResponseSchema = stockHistoryResponseSchema(ShortSellingHistoryItemSchema)
const renderMarketSummaryResponseSchema = z.object({ sent: z.number() })

export const getMarketSummary = () =>
  client.get('/market-summary').then(r => MarketSummaryResponseSchema.parse(r.data))

export const getWatchStocks = () =>
  client.get('/watch-stocks').then(r => watchStocksResponseSchema.parse(r.data))

export const registerWatchStock = (stockCode: string) => client.post(`/watch-stocks/${stockCode}`)

export const unregisterWatchStock = (stockCode: string) => client.delete(`/watch-stocks/${stockCode}`)

export const designateAsPrimaryWatchStock = (stockCode: string) =>
  client.patch(`/watch-stocks/${stockCode}/primary`)

export const clearPrimaryWatchStock = (stockCode: string) =>
  client.delete(`/watch-stocks/${stockCode}/primary`)

export const registerAsPrimaryWatchStock = (stockCode: string) =>
  client.put(`/watch-stocks/${stockCode}/primary`)

export const getStocks = () =>
  client.get('/stocks').then(r => stocksResponseSchema.parse(r.data))

export const getIntradayTop = (
  market: MarketQuery,
  investor: IntradayInvestor,
  ranking: IntradayRanking,
  amtQty: AmtQty,
) =>
  client
    .get('/intraday-top', {
      params: { market, investor, ranking, amtQty },
    })
    .then(r => intradayTopResponseSchema.parse(r.data))

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

export const getProgramTradingHistoryByRange = (
  stockCode: string,
  from: string,
  to: string,
) =>
  client
    .get(
      `/stocks/${stockCode}/program-trading/range`,
      { params: { from, to } },
    )
    .then(r => programTradingHistoryResponseSchema.parse(r.data))

export const getProgramTradingHistory = (stockCode: string) =>
  client
    .get(
      `/stocks/${stockCode}/program-trading`,
    )
    .then(r => programTradingHistoryResponseSchema.parse(r.data))

export const getProgramTradingDailyHistoryByRange = (
  stockCode: string,
  from: string,
  to: string,
) =>
  client
    .get(
      `/stocks/${stockCode}/program-trading/daily/range`,
      { params: { from, to } },
    )
    .then(r => programTradingDailyHistoryResponseSchema.parse(r.data))

export const getProgramTradingDailyHistory = (stockCode: string) =>
  client
    .get(
      `/stocks/${stockCode}/program-trading/daily`,
    )
    .then(r => programTradingDailyHistoryResponseSchema.parse(r.data))

export const getShortSellingHistory = (stockCode: string) =>
  client
    .get(
      `/stocks/${stockCode}/short-selling`,
    )
    .then(r => shortSellingHistoryResponseSchema.parse(r.data))

export const renderMarketSummary = () =>
  client.post('/render-market-summary').then(r => renderMarketSummaryResponseSchema.parse(r.data))
