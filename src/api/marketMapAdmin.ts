import client from './client'
import {
  CategoryItemSchema,
  CategoryDeletePreviewSchema,
  VersionItemSchema,
  StockCategoryListItemSchema,
  BulkAssignResponseSchema,
  snapshotResponseSchema,
  MarketMapScaleThresholdSchema,
} from '@/types/api'
import { z } from 'zod'

const categoryListResponseSchema = z.array(CategoryItemSchema)
const versionListResponseSchema = z.array(VersionItemSchema)
const stockCategoryListResponseSchema = snapshotResponseSchema(StockCategoryListItemSchema)

export const getCategories = () =>
  client.get('/admin/market-map/categories').then(r => categoryListResponseSchema.parse(r.data))

export const createCategory = (name: string, parentId: number | null) =>
  client
    .post('/admin/market-map/categories', { name, parentId })
    .then(r => CategoryItemSchema.parse(r.data))

export const renameCategory = (id: number, name: string) =>
  client.patch(`/admin/market-map/categories/${id}/name`, { name })

// parentId가 null이면 최상위(루트)로 이동.
export const reparentCategory = (id: number, parentId: number | null) =>
  client.patch(`/admin/market-map/categories/${id}/parent`, { categoryId: parentId })

export const getCategoryDeletePreview = (id: number) =>
  client
    .get(`/admin/market-map/categories/${id}/delete-preview`)
    .then(r => CategoryDeletePreviewSchema.parse(r.data))

export const deleteCategory = (id: number) => client.delete(`/admin/market-map/categories/${id}`)

export const getVersions = () =>
  client.get('/admin/market-map/versions').then(r => versionListResponseSchema.parse(r.data))

export const getCurrentVersion = () =>
  client
    .get('/admin/market-map/versions/current')
    .then(r => VersionItemSchema.nullable().parse(r.data))

export const saveVersion = (label: string) =>
  client.post('/admin/market-map/versions', { label }).then(r => VersionItemSchema.parse(r.data))

export const overwriteVersion = (id: number, label: string) =>
  client
    .patch(`/admin/market-map/versions/${id}`, { label })
    .then(r => VersionItemSchema.parse(r.data))

export const restoreVersion = (id: number) => client.post(`/admin/market-map/versions/${id}/restore`)

export const deleteVersion = (id: number) => client.delete(`/admin/market-map/versions/${id}`)

export const assignStockCategory = (stockCode: string, categoryId: number) =>
  client.put(`/admin/market-map/stock-categories/${stockCode}`, { categoryId })

export const updateAlias = (stockCode: string, alias: string | null) =>
  client.patch(`/admin/market-map/stock-categories/${stockCode}/alias`, { alias })

export const bulkAssignStockCategory = (stockCodes: string[], categoryId: number) =>
  client
    .patch('/admin/market-map/stock-categories/bulk', { stockCodes, categoryId })
    .then(r => BulkAssignResponseSchema.parse(r.data))

export const getStockCategories = () =>
  client.get('/admin/market-map/stock-categories').then(r => stockCategoryListResponseSchema.parse(r.data))

// 색상 스케일 기준값(threshold) 단건 CRUD — 처음엔 전체 배열을 통째로 PUT하는 full-replace 방식이었으나,
// 삭제 하나만 하려 해도 안 건드린 행까지 매번 다 지웠다 다시 만드는 낭비였고, id를 프론트에 내려준
// 순간 그 id가 다음 저장마다 전부 새로 발급돼버려서 "id로 개별 삭제"가 애초에 불안정해져서 폐기함.
interface ScaleThresholdPayload {
  thresholdPercent: number
  color: string
  // 백엔드는 ColorLabel enum(RED/ORANGE/...) — 프론트 내부는 소문자 기준이라 여기서만 대문자로 변환한다.
  colorLabel: string | null
}
const toScaleThresholdRequestBody = (payload: ScaleThresholdPayload) => ({
  ...payload,
  colorLabel: payload.colorLabel?.toUpperCase() ?? null,
})

export const createMarketMapScaleThreshold = (payload: ScaleThresholdPayload) =>
  client
    .post('/admin/market-map/scale', toScaleThresholdRequestBody(payload))
    .then(r => MarketMapScaleThresholdSchema.parse(r.data))

export const updateMarketMapScaleThreshold = (id: number, payload: ScaleThresholdPayload) =>
  client
    .put(`/admin/market-map/scale/${id}`, toScaleThresholdRequestBody(payload))
    .then(r => MarketMapScaleThresholdSchema.parse(r.data))

export const deleteMarketMapScaleThreshold = (id: number) => client.delete(`/admin/market-map/scale/${id}`)
