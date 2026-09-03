import client from './client'
import {
  CategoryChangeRateResponseSchema,
  ExcludedStockItemSchema,
  MarketMapResponseSchema,
  MarketMapScaleResponseSchema,
  MarketValueTierListResponseSchema,
  type MarketQuery,
} from '@/types/api'
import { z } from 'zod'

const excludedStockListResponseSchema = z.array(ExcludedStockItemSchema)

export const getMarketMap = (market: MarketQuery, isCustom: boolean) =>
  client.get('/market-map', { params: { market, isCustom } }).then(r => MarketMapResponseSchema.parse(r.data))

export const getMarketValueTiers = () =>
  client.get('/market-map/value-tiers').then(r => MarketValueTierListResponseSchema.parse(r.data))

export const getCategoryChangeRates = (market: MarketQuery, beforeMinutes: number) =>
  client
    .get('/market-map/category-change-rates', { params: { market, beforeMinutes } })
    .then(r => CategoryChangeRateResponseSchema.parse(r.data))

export const getMarketMapScale = () =>
  client.get('/market-map/scale').then(r => MarketMapScaleResponseSchema.parse(r.data))

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
