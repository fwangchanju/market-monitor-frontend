import client from './client'
import {
  ExcludedStockItemSchema,
  MarketMapResponseSchema,
  StockCategoryItemSchema,
  type Market,
} from '@/types/api'
import { z } from 'zod'

const excludedStockListResponseSchema = z.array(ExcludedStockItemSchema)
const stockCategoryListResponseSchema = z.array(StockCategoryItemSchema)

export const getMarketMap = (market: Market, isExclude: boolean) =>
  client
    .get('/market-map', { params: { market, isExclude } })
    .then(r => MarketMapResponseSchema.parse(r.data))

export const getExcludedStocks = () =>
  client.get('/market-map/excluded-stocks').then(r => excludedStockListResponseSchema.parse(r.data))

export const registerExcludedStock = (stockCode: string) =>
  client.post(`/market-map/excluded-stocks/${stockCode}`)

export const unregisterExcludedStock = (stockCode: string) =>
  client.delete(`/market-map/excluded-stocks/${stockCode}`)

export const deleteAllExcludedStocks = () => client.delete('/market-map/excluded-stocks')

export const getStockCategories = () =>
  client.get('/market-map/categories').then(r => stockCategoryListResponseSchema.parse(r.data))

export const reassignCategory = (stockCode: string, categoryName: string) =>
  client.patch(`/market-map/categories/${stockCode}`, { categoryName })

export const deleteCategory = (stockCode: string) => client.delete(`/market-map/categories/${stockCode}`)

export const deleteAllCategories = () => client.delete('/market-map/categories')

export const resetMarketMap = () => client.delete('/market-map/reset')
