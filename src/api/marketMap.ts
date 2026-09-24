import client from './client'
import {
  ExcludedStockItemSchema,
  MarketMapResponseSchema,
  MarketMapScaleResponseSchema,
  MarketValueTierListResponseSchema,
  type MarketQuery,
} from '@/types/api'
import { z } from 'zod'

const excludedStockListResponseSchema = z.array(ExcludedStockItemSchema)

export const getMarketMap = (market: MarketQuery, isCustom: boolean, snapshotTime?: string) =>
  client
    .get('/map', { params: { market, isCustom, ...(snapshotTime ? { snapshotTime } : {}) } })
    .then(r => MarketMapResponseSchema.parse(r.data))

export const getMarketValueTiers = () =>
  client.get('/map/value-tiers').then(r => MarketValueTierListResponseSchema.parse(r.data))

export const getMarketMapScale = () =>
  client.get('/map/scale').then(r => MarketMapScaleResponseSchema.parse(r.data))

export const getExcludedStocks = () =>
  client.get('/map/excluded-stocks').then(r => excludedStockListResponseSchema.parse(r.data))

export const registerExcludedStock = (stockCode: string) =>
  client.post(`/map/excluded-stocks/${stockCode}`)

export const unregisterExcludedStock = (stockCode: string) =>
  client.delete(`/map/excluded-stocks/${stockCode}`)

export const deleteAllExcludedStocks = () => client.delete('/map/excluded-stocks')

// 종목 단위 대신 카테고리 단위로 제외한다 — 상태(is_excluded)는 market_map_category에 저장되고,
// 마켓맵 응답의 각 카테고리 노드에 isExcluded로 같이 내려온다.
export const registerExcludedCategory = (categoryId: number) =>
  client.post(`/map/excluded-categories/${categoryId}`)

export const unregisterExcludedCategory = (categoryId: number) =>
  client.delete(`/map/excluded-categories/${categoryId}`)

export const deleteAllExcludedCategories = () => client.delete('/map/excluded-categories')
