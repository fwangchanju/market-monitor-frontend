import { http, HttpResponse } from 'msw'
import * as data from './data'

const snapshot = <T>(items: T[]) => ({ snapshotTime: new Date().toISOString().slice(0, 19), items })
// 응답의 snapshotTime은 "가장 최근 항목 시각"으로 맞춰서 isStale 오탐(빨간 테두리)이 안 뜨게 함.
const stockHistory = <T>(stockCode: string | null, items: T[], latestSnapshotTime: string | null) => ({
  stockCode,
  snapshotTime: items.length > 0 ? latestSnapshotTime : null,
  items,
})
const ok = () => HttpResponse.json({})

export const handlers = [
  // ── 대시보드(시장요약) ──────────────────────────────────────────────
  http.get('/api/market-summary', () =>
    HttpResponse.json({
      marketOverviews: snapshot(data.marketOverviews),
      investorTradingSummaries: snapshot(data.investorTradingSummaries),
      intradayTopRankings: snapshot(data.intradayTopItems),
      programTradingHighlights: snapshot(data.programTradingRankingItems),
      indexContributionHighlights: snapshot(data.indexContributionItems),
      mainShortSellingHistory: stockHistory('005930', data.shortSellingHistoryItems, data.shortSellingHistoryItems[0]?.tradeDate ?? null),
      mainProgramTradingHistory: stockHistory('005930', data.programTradingHistoryItems, data.programTradingHistoryItems[0]?.snapshotTime ?? null),
    }),
  ),

  http.get('/api/intraday-top', () => HttpResponse.json(snapshot(data.intradayTopItems))),
  http.get('/api/program-trading-rankings', () => HttpResponse.json(snapshot(data.programTradingRankingItems))),
  http.get('/api/index-contribution', () => HttpResponse.json(snapshot(data.indexContributionItems))),

  // ── 종목 마스터/관심종목 ────────────────────────────────────────────
  http.get('/api/stocks', () => HttpResponse.json(data.stocks)),
  http.get('/api/watch-stocks', () => HttpResponse.json(data.watchStocks)),
  http.post('/api/watch-stocks/:stockCode', ok),
  http.delete('/api/watch-stocks/:stockCode', ok),
  http.patch('/api/watch-stocks/:stockCode/primary', ok),
  http.put('/api/watch-stocks/:stockCode/primary', ok),
  http.delete('/api/watch-stocks/:stockCode/primary', ok),

  // ── 종목별 이력 ─────────────────────────────────────────────────────
  http.get('/api/stocks/:stockCode/program-trading', () =>
    HttpResponse.json(
      stockHistory('005930', data.programTradingHistoryItems, data.programTradingHistoryItems[0]?.snapshotTime ?? null),
    ),
  ),
  http.get('/api/stocks/:stockCode/program-trading/daily', () =>
    HttpResponse.json(stockHistory('005930', data.programTradingDailyItems, null)),
  ),
  http.get('/api/stocks/:stockCode/short-selling', () =>
    HttpResponse.json(stockHistory('005930', data.shortSellingHistoryItems, null)),
  ),

  // ── 마켓맵 ──────────────────────────────────────────────────────────
  http.get('/api/market-map', () => HttpResponse.json(snapshot(data.marketMapGroups))),
  http.get('/api/market-map/excluded-stocks', () => HttpResponse.json(data.excludedStocks)),
  http.post('/api/market-map/excluded-stocks/:stockCode', ok),
  http.delete('/api/market-map/excluded-stocks/:stockCode', ok),
  http.delete('/api/market-map/excluded-stocks', ok),
  http.get('/api/market-map/categories', () => HttpResponse.json(data.stockCategories)),
  http.patch('/api/market-map/categories/:stockCode', ok),
  http.delete('/api/market-map/categories/:stockCode', ok),
  http.delete('/api/market-map/categories', ok),
  http.delete('/api/market-map/reset', ok),

  // ── 관리자(허용 IP) ─────────────────────────────────────────────────
  http.get('/api/admin/allowed-ips', () => HttpResponse.json(data.allowedIps)),
  http.post('/api/admin/allowed-ips/:ip', ok),
  http.delete('/api/admin/allowed-ips/:ip', ok),
]
