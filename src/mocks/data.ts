// 로컬 mock 서버(MSW)용 가짜 데이터. 실제 화면 확인용이라 값 자체의 정확성은 중요하지 않음.

const now = () => new Date().toISOString().slice(0, 19)

export const stocks = [
  { stockCode: '005930', stockName: '삼성전자', market: 'KOSPI' as const },
  { stockCode: '000660', stockName: 'SK하이닉스', market: 'KOSPI' as const },
  { stockCode: '035420', stockName: 'NAVER', market: 'KOSPI' as const },
  { stockCode: '051910', stockName: 'LG화학', market: 'KOSPI' as const },
  { stockCode: '373220', stockName: 'LG에너지솔루션', market: 'KOSPI' as const },
  { stockCode: '035720', stockName: '카카오', market: 'KOSDAQ' as const },
  { stockCode: '247540', stockName: '에코프로비엠', market: 'KOSDAQ' as const },
  { stockCode: '091990', stockName: '셀트리온헬스케어', market: 'KOSDAQ' as const },
]

export const watchStocks = [
  { stockCode: '005930', stockName: '삼성전자', market: 'KOSPI' as const, isMain: true, registerBy: 'USER' as const },
  { stockCode: '000660', stockName: 'SK하이닉스', market: 'KOSPI' as const, isMain: false, registerBy: 'HOLDINGS' as const },
  { stockCode: '035720', stockName: '카카오', market: 'KOSDAQ' as const, isMain: false, registerBy: 'USER' as const },
]

export const marketOverviews = [
  {
    market: 'KOSPI' as const,
    marketStatus: '장중',
    indexValue: 2612.34,
    changeValue: 12.5,
    changeRate: 0.48,
    tradingValue: 8_231_000,
    upperLimitCount: 3,
    lowerLimitCount: 1,
    advancers: 512,
    decliners: 340,
    unchangedCount: 87,
    snapshotTime: now(),
  },
  {
    market: 'KOSDAQ' as const,
    marketStatus: '장중',
    indexValue: 812.11,
    changeValue: -3.2,
    changeRate: -0.39,
    tradingValue: 4_112_000,
    upperLimitCount: 5,
    lowerLimitCount: 2,
    advancers: 601,
    decliners: 480,
    unchangedCount: 120,
    snapshotTime: now(),
  },
]

const investors = [
  'PERSONAL', 'FOREIGNER', 'INSTITUTION', 'FINANCIAL_INVESTMENT', 'TRUST', 'PENSION_FUND',
] as const

export const investorTradingSummaries = ['KOSPI', 'KOSDAQ'].flatMap(market =>
  investors.map(investor => ({
    market: market as 'KOSPI' | 'KOSDAQ',
    investor,
    buyAmount: 0,
    sellAmount: 0,
    netBuyAmount: Math.round((Math.random() - 0.5) * 2000),
    snapshotTime: now(),
  })),
)

export const intradayTopItems = stocks.slice(0, 5).map((s, i) => ({
  stockCode: s.stockCode,
  stockName: s.stockName,
  netBuyAmount: Math.round((5 - i) * 1234 * (Math.random() > 0.3 ? 1 : -1)),
  snapshotTime: now(),
}))

export const programTradingRankingItems = stocks.slice(0, 5).map((s, i) => ({
  rank: i + 1,
  stockCode: s.stockCode,
  stockName: s.stockName,
  programBuyAmount: 10000 - i * 1000,
  programSellAmount: 8000 - i * 800,
  programNetBuyAmount: 2000 - i * 200,
  snapshotTime: now(),
}))

export const indexContributionItems = stocks.slice(0, 5).map((s, i) => ({
  market: (s.market === 'KOSPI' ? 'KOSPI' : 'KOSDAQ') as 'KOSPI' | 'KOSDAQ',
  rank: i + 1,
  stockCode: s.stockCode,
  stockName: s.stockName,
  contributionScore: Math.round((5 - i) * 3.7 * 100) / 100,
  priceChangeRate: Math.round((Math.random() * 4 - 2) * 100) / 100,
  snapshotTime: now(),
}))

// 실제 백엔드는 snapshotTime/tradeDate 내림차순(최신이 index 0)으로 반환하므로 동일하게 구성.
export const programTradingHistoryItems = Array.from({ length: 20 }, (_, i) => ({
  snapshotTime: new Date(Date.now() - i * 60 * 60 * 1000).toISOString().slice(0, 19),
  programBuyAmount: 5000 + i * 30,
  programSellAmount: 4800 + i * 20,
  programNetBuyAmount: 200 + i * 10,
}))

export const programTradingDailyItems = Array.from({ length: 20 }, (_, i) => ({
  tradeDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  programBuyAmount: 50000 + i * 300,
  programSellAmount: 48000 + i * 200,
  programNetBuyAmount: 2000 + i * 100,
}))

export const shortSellingHistoryItems = Array.from({ length: 20 }, (_, i) => ({
  tradeDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  closePrice: 70000 + i * 120,
  priceChange: i % 2 === 0 ? 500 : -300,
  changeRate: i % 2 === 0 ? 0.7 : -0.4,
  tradingVolume: 12_000_000 + i * 10000,
  shortVolume: 300_000 + i * 1000,
  cumulativeShortVolume: 8_000_000 + i * 5000,
  shortRatio: 2.5 + (i % 5) * 0.1,
  shortAmount: 21_000_000 + i * 10000,
  shortAvgPrice: 69500 + i * 100,
}))

export const marketMapGroups = [
  {
    categoryName: '반도체',
    items: [
      { stockCode: '005930', stockName: '삼성전자', lastPrice: 71000, totalMarketValue: 420_000_000_000_000, changeRate: 1.2, snapshotTime: now() },
      { stockCode: '000660', stockName: 'SK하이닉스', lastPrice: 178000, totalMarketValue: 130_000_000_000_000, changeRate: -0.8, snapshotTime: now() },
    ],
  },
  {
    categoryName: '2차전지',
    items: [
      { stockCode: '051910', stockName: 'LG화학', lastPrice: 412000, totalMarketValue: 29_000_000_000_000, changeRate: 2.1, snapshotTime: now() },
      { stockCode: '373220', stockName: 'LG에너지솔루션', lastPrice: 398000, totalMarketValue: 93_000_000_000_000, changeRate: -1.5, snapshotTime: now() },
    ],
  },
  {
    categoryName: '인터넷/플랫폼',
    items: [
      { stockCode: '035420', stockName: 'NAVER', lastPrice: 198000, totalMarketValue: 32_000_000_000_000, changeRate: 0.3, snapshotTime: now() },
      { stockCode: '035720', stockName: '카카오', lastPrice: 41500, totalMarketValue: 18_000_000_000_000, changeRate: 3.4, snapshotTime: now() },
    ],
  },
]

export const excludedStocks: { stockCode: string; stockName: string }[] = []
export const stockCategories: { stockCode: string; stockName: string; categoryName: string }[] = []

// ── 마켓맵 어드민(신규 커스텀 시스템) ───────────────────────────────────
export const adminCategories = [
  { id: 1, name: '반도체', parentId: null, depth: 0, displayOrder: 1, isSynced: true },
  { id: 2, name: '2차전지', parentId: null, depth: 0, displayOrder: 2, isSynced: true },
  { id: 3, name: '인터넷/플랫폼', parentId: null, depth: 0, displayOrder: 3, isSynced: true },
  { id: 4, name: '메모리', parentId: 1, depth: 1, displayOrder: 1, isSynced: false },
  { id: 5, name: '파운드리', parentId: 1, depth: 1, displayOrder: 2, isSynced: false },
  { id: 6, name: '양극재', parentId: 2, depth: 1, displayOrder: 1, isSynced: false },
]

export const adminStockCategories: { stockCode: string; stockName: string; categoryName: string }[] = [
  { stockCode: '005930', stockName: '삼성전자', categoryName: '메모리' },
  { stockCode: '000660', stockName: 'SK하이닉스', categoryName: '파운드리' },
  { stockCode: '051910', stockName: 'LG화학', categoryName: '양극재' },
  { stockCode: '373220', stockName: 'LG에너지솔루션', categoryName: '2차전지' },
  { stockCode: '035420', stockName: 'NAVER', categoryName: '인터넷/플랫폼' },
  { stockCode: '035720', stockName: '카카오', categoryName: '인터넷/플랫폼' },
]

export const adminVersions = [
  { id: 1, label: '2026-07-초안', createdAt: '2026-07-01T09:00:00', updatedAt: '2026-07-01T09:00:00' },
  { id: 2, label: '분기 정기 저장', createdAt: '2026-08-01T09:00:00', updatedAt: '2026-08-01T09:00:00' },
]

export const allowedIps = [
  { ip: '127.0.0.1', createdAt: now() },
  { ip: '10.0.0.5', createdAt: now() },
]
