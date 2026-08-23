import client from './client'
import { ExcludedStockItemSchema, MarketMapResponseSchema, type Market } from '@/types/api'
import { z } from 'zod'

const excludedStockListResponseSchema = z.array(ExcludedStockItemSchema)

export const getMarketMap = (market: Market, isCustom: boolean) =>
  client.get('/market-map', { params: { market, isCustom } }).then(r => MarketMapResponseSchema.parse(r.data))

export const getExcludedStocks = () =>
  client.get('/market-map/excluded-stocks').then(r => excludedStockListResponseSchema.parse(r.data))

export const registerExcludedStock = (stockCode: string) =>
  client.post(`/market-map/excluded-stocks/${stockCode}`)

export const unregisterExcludedStock = (stockCode: string) =>
  client.delete(`/market-map/excluded-stocks/${stockCode}`)

export const deleteAllExcludedStocks = () => client.delete('/market-map/excluded-stocks')

// 종목 단위 대신 카테고리 단위로 제외한다 — 상태(is_excluded)는 market_map_category에 저장되고,
// 마켓맵 응답의 각 카테고리 노드에 isExcluded로 같이 내려온다.
export const registerExcludedCategory = (categoryId: number) =>
  client.post(`/market-map/excluded-categories/${categoryId}`)

export const unregisterExcludedCategory = (categoryId: number) =>
  client.delete(`/market-map/excluded-categories/${categoryId}`)

export const deleteAllExcludedCategories = () => client.delete('/market-map/excluded-categories')
