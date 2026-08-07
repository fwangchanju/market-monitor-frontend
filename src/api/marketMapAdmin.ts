import client from './client'
import { CategoryItemSchema, CategoryDeletePreviewSchema, VersionItemSchema, StockCategoryItemSchema } from '@/types/api'
import { z } from 'zod'

const categoryListResponseSchema = z.array(CategoryItemSchema)
const versionListResponseSchema = z.array(VersionItemSchema)
const stockCategoryListResponseSchema = z.array(StockCategoryItemSchema)

export const getCategories = () =>
  client.get('/admin/market-map/categories').then(r => categoryListResponseSchema.parse(r.data))

export const createCategory = (name: string, parentId: number | null) =>
  client
    .post('/admin/market-map/categories', { name, parentId })
    .then(r => CategoryItemSchema.parse(r.data))

export const renameCategory = (id: number, name: string) =>
  client.patch(`/admin/market-map/categories/${id}/name`, { name })

export const reorderCategory = (id: number, displayOrder: number) =>
  client.patch(`/admin/market-map/categories/${id}/order`, { displayOrder })

export const reparentCategory = (id: number, parentId: number) =>
  client.patch(`/admin/market-map/categories/${id}/parent`, { parentId })

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

export const getStockCategories = () =>
  client.get('/admin/market-map/stock-categories').then(r => stockCategoryListResponseSchema.parse(r.data))
