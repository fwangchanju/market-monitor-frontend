import client from './client'
import {
  ExcludedStockItemSchema,
  MarketMapResponseSchema,
  MarketMapScaleResponseSchema,
  MarketValueTierListResponseSchema,
  type MarketQuery,
} from '@/types/api'
import { z } from 'zod'
import type { ClassificationSource } from '@/utils/heatmapNames'

const excludedStockListResponseSchema = z.array(ExcludedStockItemSchema)

// 등락률 기준 — daily는 전일 종가 대비 누적(기본), afterHours는 그날 정규장 종가 대비(15:40 이후 오늘 스냅샷에서만 적용된다).
export type ChangeRateBasis = 'daily' | 'afterHours'

// source는 어떤 분류로 그릴지다 — krx(거래소), marketry(올린 분류, 로그인 없이 읽는다), mymap(내 히트맵, 로그인 필요).
// nxtOnly는 NXT 거래 종목만 받는다. false일 때는 요청에 싣지 않는다. basis도 afterHours일 때만 요청에 싣는다.
export const getMarketMap = (
  market: MarketQuery,
  source: ClassificationSource,
  snapshotTime?: string,
  nxtOnly = false,
  basis: ChangeRateBasis = 'daily',
) =>
  client
    .get('/map', {
      params: {
        market,
        source,
        ...(snapshotTime ? { snapshotTime } : {}),
        ...(nxtOnly ? { nxtOnly } : {}),
        ...(basis === 'afterHours' ? { basis } : {}),
      },
    })
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

// 종목 단위 대신 섹터 단위로 제외한다 — 상태(is_excluded)는 market_map_category에 저장되고,
// 마켓맵 응답의 각 섹터 노드에 isExcluded로 같이 내려온다.
export const registerExcludedSector = (sectorId: number) =>
  client.post(`/map/excluded-sectors/${sectorId}`)

export const unregisterExcludedSector = (sectorId: number) =>
  client.delete(`/map/excluded-sectors/${sectorId}`)

export const deleteAllExcludedSectors = () => client.delete('/map/excluded-sectors')
