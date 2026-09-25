import { http, HttpResponse, delay } from 'msw'
import * as data from './data'

const snapshot = <T>(items: T[]) => ({ snapshotTime: new Date().toISOString().slice(0, 19), items })
// 응답의 snapshotTime은 "가장 최근 항목 시각"으로 맞춰서 isStale 오탐(빨간 테두리)이 안 뜨게 함.
const stockHistory = <T>(stockCode: string | null, items: T[], latestSnapshotTime: string | null) => ({
  stockCode,
  snapshotTime: items.length > 0 ? latestSnapshotTime : null,
  items,
})
const ok = () => HttpResponse.json({})
const anonymousSession = () => HttpResponse.json({ authenticated: false, userId: null, email: null, role: null })
const authenticatedSession = () =>
  HttpResponse.json({
    authenticated: true,
    userId: data.mockAuth.userId,
    email: data.mockAuth.email,
    role: data.mockAuth.role,
  })

export const handlers = [
  // ── 인증(가입/로그인 전환) ────────────────────────────────────────────
  // 실제 Google OAuth 대신, dev:mock에서는 이 요청 자체를 "로그인 성공"으로 취급하고 곧바로
  // returnTo로 리다이렉트한다 — LoginModal의 <a href>가 실제 페이지 이동을 트리거하므로 여기서도
  // 진짜 302로 응답해야 브라우저가 실제로 그 경로로 이동한다.
  http.get('/api/auth/google', ({ request }) => {
    const url = new URL(request.url)
    const returnTo = url.searchParams.get('returnTo') || '/'
    data.mockAuth.authenticated = true
    return new HttpResponse(null, { status: 302, headers: { Location: returnTo } })
  }),
  http.get('/api/auth/session', () => (data.mockAuth.authenticated ? authenticatedSession() : anonymousSession())),
  http.post('/api/auth/refresh', () =>
    data.mockAuth.authenticated ? authenticatedSession() : new HttpResponse(null, { status: 401 }),
  ),
  http.post('/api/auth/logout', () => {
    data.mockAuth.authenticated = false
    return new HttpResponse(null, { status: 204 })
  }),

  // ── 대시보드(시장요약, /summary는 빈 껍데기라 이제 호출되지 않지만 목업은 남겨둔다) ──────────
  http.get('/api/summary', () =>
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

  // ── 종목 마스터/관심종목(관리자 전용 API는 그대로 유지, 화면 UI는 제거됨) ───────────────────
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

  // ── 마켓맵(공개 기본 조회) ────────────────────────────────────────────
  // marketOverview는 market이 단일 마켓일 때만(ALL_STOCK이면 단일 지수값이 없어 null) — 실제 백엔드와 동일.
  // 지연을 둬서 섹터 페이지 쌍 쿼리의 placeholder·스피너를 dev:mock에서 눈으로 볼 수 있게 한다(결정 7).
  // isCustom=true는 비로그인이면 실제로는 401이지만(가입/로그인 전환 4), 프론트가 이미 비로그인에서
  // isCustom을 강제로 false로 두므로 목업에서 그 가드까지 재현할 필요는 없다.
  http.get('/api/map', async ({ request }) => {
    await delay(1200)
    const url = new URL(request.url)
    const market = url.searchParams.get('market')
    const isCustom = url.searchParams.get('isCustom') === 'true'
    const snapshotTime = url.searchParams.get('snapshotTime')
    const marketOverview = data.marketOverviews.find(o => o.market === market) ?? null
    const tree = isCustom ? data.marketMapTree : data.toDefaultModeTree(data.marketMapTree)

    if (!snapshotTime) {
      return HttpResponse.json({ ...snapshot(tree), marketOverview })
    }
    // snapshotTime이 있으면 그 값을 응답에 그대로 싣고(결정 4의 "요청 시각과 같아야 before로 인정" 조건을
    // 목업에서도 통과시키기 위함), 종목 changeRate를 낮춘 트리를 준다.
    return HttpResponse.json({
      snapshotTime,
      items: data.shiftMarketMapTreeChangeRates(tree),
      marketOverview: marketOverview
        ? { ...marketOverview, changeRate: marketOverview.changeRate - data.MOCK_BEFORE_INDEX_CHANGE_RATE_DELTA }
        : null,
    })
  }),
  // 공개 기본값 — 로그인 사용자는 아래 /custom/value-tiers, /custom/scale로 각자 값을 받는다.
  http.get('/api/map/value-tiers', () => HttpResponse.json(data.marketValueTiers)),
  http.get('/api/map/scale', () => HttpResponse.json(data.marketMapColorScale)),
  http.get('/api/map/excluded-stocks', () => HttpResponse.json(data.excludedStocks)),
  http.post('/api/map/excluded-stocks/:stockCode', ok),
  http.delete('/api/map/excluded-stocks/:stockCode', ok),
  http.delete('/api/map/excluded-stocks', ok),
  http.post('/api/map/excluded-categories/:categoryId', ok),
  http.delete('/api/map/excluded-categories/:categoryId', ok),
  http.delete('/api/map/excluded-categories', ok),
  http.delete('/api/map/reset', ok),

  // ── 커스텀(로그인 사용자 전용, /api/admin/market-map/* → /api/custom/* 전환) ────────────────
  http.get('/api/custom/sectors', () => HttpResponse.json(data.customSectors)),
  http.post('/api/custom/sectors', async ({ request }) => {
    const body = (await request.json()) as { name: string; parentId: number | null }
    const parent = body.parentId != null ? data.customSectors.find(c => c.id === body.parentId) : null
    return HttpResponse.json({
      id: Math.floor(Math.random() * 1_000_000),
      name: body.name,
      parentId: body.parentId,
      depth: parent ? parent.depth + 1 : 0,
    })
  }),
  http.patch('/api/custom/sectors/:id/name', ok),
  http.patch('/api/custom/sectors/:id/parent', ok),
  http.get('/api/custom/sectors/:id/delete-preview', ({ params }) => {
    const sector = data.customSectors.find(c => c.id === Number(params.id))
    if (!sector) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json({ sectorName: sector.name, deletable: true, blockingStocks: [], deletableSectors: [] })
  }),
  http.delete('/api/custom/sectors/:id', ok),
  http.get('/api/custom/snapshots', () => HttpResponse.json(data.customSnapshots)),
  http.get('/api/custom/snapshots/current', () => HttpResponse.json(data.customSnapshots[0] ?? null)),
  http.post('/api/custom/snapshots', async ({ request }) => {
    const body = (await request.json()) as { label: string }
    const nowText = new Date().toISOString().slice(0, 19)
    return HttpResponse.json({ id: Math.floor(Math.random() * 1_000_000), label: body.label, createdAt: nowText, updatedAt: nowText })
  }),
  http.patch('/api/custom/snapshots/:id', async ({ request, params }) => {
    const body = (await request.json()) as { label: string }
    const existing = data.customSnapshots.find(v => v.id === Number(params.id))
    return HttpResponse.json({
      id: Number(params.id),
      label: body.label,
      createdAt: existing?.createdAt ?? new Date().toISOString().slice(0, 19),
      updatedAt: new Date().toISOString().slice(0, 19),
    })
  }),
  http.post('/api/custom/snapshots/:id/restore', ok),
  http.delete('/api/custom/snapshots/:id', ok),
  http.post('/api/custom/scale', async ({ request }) => {
    const body = (await request.json()) as { thresholdPercent: number; color: string; colorLabel: string | null }
    return HttpResponse.json({ id: Math.floor(Math.random() * 1_000_000), ...body })
  }),
  http.put('/api/custom/scale/:id', async ({ request, params }) => {
    const body = (await request.json()) as { thresholdPercent: number; color: string; colorLabel: string | null }
    return HttpResponse.json({ id: Number(params.id), ...body })
  }),
  http.delete('/api/custom/scale/:id', ok),
  // 로그인 사용자 본인 값 — dev:mock에서는 공개 기본값과 동일한 목업 데이터를 그대로 재사용한다.
  http.get('/api/custom/scale', () => HttpResponse.json(data.marketMapColorScale)),
  http.get('/api/custom/value-tiers', () => HttpResponse.json(data.marketValueTiers)),
  http.get('/api/custom/stock-sectors', () => HttpResponse.json(snapshot(data.customStockSectors))),
  http.put('/api/custom/stock-sectors/:stockCode', ok),
  http.patch('/api/custom/stock-sectors/:stockCode/alias', ok),
  http.delete('/api/custom/stock-sectors/:stockCode/alias', ok),
  http.patch('/api/custom/stock-sectors/bulk', async ({ request }) => {
    const body = (await request.json()) as { stockCodes: string[]; sectorId: number }
    return HttpResponse.json({ failedStockCodes: [], sectorId: body.sectorId })
  }),

  // 사용자가 바꾼 값만 담는 sparse JSON — 전체 교체(PUT)만 지원한다.
  http.get('/api/custom/preferences', () => HttpResponse.json(data.mockCustomPreferences)),
  http.put('/api/custom/preferences', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    Object.keys(data.mockCustomPreferences).forEach(key => delete data.mockCustomPreferences[key])
    Object.assign(data.mockCustomPreferences, body)
    return HttpResponse.json({})
  }),
]
