import client from './client'
import { ExcludedStockItemSchema, MarketMapResponseSchema, type Market } from '@/types/api'
import { z } from 'zod'

const excludedStockListResponseSchema = z.array(ExcludedStockItemSchema)

export const getMarketMap = (market: Market, isExclude: boolean, isCustom: boolean) =>
  client
    .get('/market-map', { params: { market, isExclude, isCustom } })
    .then(r => MarketMapResponseSchema.parse(r.data))

export const getExcludedStocks = () =>
  client.get('/market-map/excluded-stocks').then(r => excludedStockListResponseSchema.parse(r.data))

export const registerExcludedStock = (stockCode: string) =>
  client.post(`/market-map/excluded-stocks/${stockCode}`)

export const unregisterExcludedStock = (stockCode: string) =>
  client.delete(`/market-map/excluded-stocks/${stockCode}`)

export const deleteAllExcludedStocks = () => client.delete('/market-map/excluded-stocks')
