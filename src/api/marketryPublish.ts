import client from './client'
import { z } from 'zod'

// MARKETRY 고정본 올리기·버전 목록·되돌리기 — 관리자(ADMIN)만 쓸 수 있다(서버가 /api/admin/** 규칙으로 막는다).
const MarketryPublicationSchema = z.object({
  id: z.number(),
  label: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type MarketryPublication = z.infer<typeof MarketryPublicationSchema>

export const publishMarketry = (label: string) =>
  client.post('/admin/marketry/publications', { label }).then(r => MarketryPublicationSchema.parse(r.data))

export const getMarketryPublications = () =>
  client.get('/admin/marketry/publications').then(r => z.array(MarketryPublicationSchema).parse(r.data))

export const restoreMarketryPublication = (publicationId: number) =>
  client.post(`/admin/marketry/publications/${publicationId}/restore`)
