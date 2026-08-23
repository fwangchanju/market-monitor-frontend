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
  http.get('/api/market-map', () => HttpResponse.json(snapshot(data.marketMapTree))),
  http.get('/api/market-map/excluded-stocks', () => HttpResponse.json(data.excludedStocks)),
  http.post('/api/market-map/excluded-stocks/:stockCode', ok),
  http.delete('/api/market-map/excluded-stocks/:stockCode', ok),
  http.delete('/api/market-map/excluded-stocks', ok),
  http.post('/api/market-map/excluded-categories/:categoryId', ok),
  http.delete('/api/market-map/excluded-categories/:categoryId', ok),
  http.delete('/api/market-map/excluded-categories', ok),
  http.delete('/api/market-map/reset', ok),

  // ── 접근 권한 ───────────────────────────────────────────────────────
  // 로컬 개발 환경에서는 항상 admin으로 취급 — 커스텀 버튼 등 admin 전용 UI를 바로 확인할 수 있게.
  http.get('/api/access/admin-status', () => HttpResponse.json({ isAdmin: true })),

  // ── 관리자(허용 IP) ─────────────────────────────────────────────────
  http.get('/api/admin/allowed-ips', () => HttpResponse.json(data.allowedIps)),
  http.post('/api/admin/allowed-ips/:ip', ok),
  http.delete('/api/admin/allowed-ips/:ip', ok),

  // ── 마켓맵 어드민(신규 커스텀 시스템) ───────────────────────────────
  http.get('/api/admin/market-map/categories', () => HttpResponse.json(data.adminCategories)),
  http.post('/api/admin/market-map/categories', async ({ request }) => {
    const body = (await request.json()) as { name: string; parentId: number | null }
    const parent = body.parentId != null ? data.adminCategories.find(c => c.id === body.parentId) : null
    return HttpResponse.json({
      id: Math.floor(Math.random() * 1_000_000),
      name: body.name,
      parentId: body.parentId,
      depth: parent ? parent.depth + 1 : 0,
    })
  }),
  http.patch('/api/admin/market-map/categories/:id/name', ok),
  http.patch('/api/admin/market-map/categories/:id/parent', ok),
  http.get('/api/admin/market-map/categories/:id/delete-preview', ({ params }) => {
    const category = data.adminCategories.find(c => c.id === Number(params.id))
    if (!category) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json({ categoryName: category.name, deletable: true, blockingStocks: [], deletableCategories: [] })
  }),
  http.delete('/api/admin/market-map/categories/:id', ok),
  http.get('/api/admin/market-map/versions', () => HttpResponse.json(data.adminVersions)),
  http.get('/api/admin/market-map/versions/current', () => HttpResponse.json(data.adminVersions[0] ?? null)),
  http.post('/api/admin/market-map/versions', async ({ request }) => {
    const body = (await request.json()) as { label: string }
    const now = new Date().toISOString().slice(0, 19)
    return HttpResponse.json({ id: Math.floor(Math.random() * 1_000_000), label: body.label, createdAt: now, updatedAt: now })
  }),
  http.patch('/api/admin/market-map/versions/:id', async ({ request, params }) => {
    const body = (await request.json()) as { label: string }
    const existing = data.adminVersions.find(v => v.id === Number(params.id))
    return HttpResponse.json({
      id: Number(params.id),
      label: body.label,
      createdAt: existing?.createdAt ?? new Date().toISOString().slice(0, 19),
      updatedAt: new Date().toISOString().slice(0, 19),
    })
  }),
  http.post('/api/admin/market-map/versions/:id/restore', ok),
  http.delete('/api/admin/market-map/versions/:id', ok),
  http.get('/api/admin/market-map/stock-categories', () => HttpResponse.json(snapshot(data.adminStockCategories))),
  http.put('/api/admin/market-map/stock-categories/:stockCode', ok),
  http.patch('/api/admin/market-map/stock-categories/:stockCode/alias', ok),
  http.patch('/api/admin/market-map/stock-categories/bulk', async ({ request }) => {
    const body = (await request.json()) as { stockCodes: string[]; categoryId: number }
    return HttpResponse.json({ failedStockCodes: [], categoryId: body.categoryId })
  }),
]
