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

export const marketMapTree = [
  {
    categoryId: 1,
    categoryName: '반도체',
    totalMarketValue: 550_000_000_000_000,
    isExcluded: false,
    items: [],
    children: [
      {
        categoryId: 4,
        categoryName: '메모리',
        totalMarketValue: 420_000_000_000_000,
        isExcluded: false,
        items: [
          { stockCode: '005930', stockName: '삼성전자', lastPrice: 71000, totalMarketValue: 420_000_000_000_000, marketValueTier: 'MEGA', changeRate: 1.2, currentPrice: 71000, snapshotTime: now() },
        ],
        children: [],
      },
      {
        categoryId: 5,
        categoryName: '파운드리',
        totalMarketValue: 130_000_000_000_000,
        isExcluded: false,
        items: [
          { stockCode: '000660', stockName: 'SK하이닉스', lastPrice: 178000, totalMarketValue: 130_000_000_000_000, marketValueTier: 'MEGA', changeRate: -0.8, currentPrice: 178000, snapshotTime: now() },
        ],
        children: [],
      },
    ],
  },
  {
    categoryId: 2,
    categoryName: '2차전지',
    totalMarketValue: 122_000_000_000_000,
    isExcluded: false,
    items: [
      { stockCode: '373220', stockName: 'LG에너지솔루션', lastPrice: 398000, totalMarketValue: 93_000_000_000_000, marketValueTier: 'LARGE', changeRate: -1.5, currentPrice: 398000, snapshotTime: now() },
    ],
    children: [
      {
        categoryId: 6,
        categoryName: '양극재',
        totalMarketValue: 29_000_000_000_000,
        isExcluded: false,
        items: [
          { stockCode: '051910', stockName: 'LG화학', lastPrice: 412000, totalMarketValue: 29_000_000_000_000, marketValueTier: 'LARGE', changeRate: 2.1, currentPrice: 412000, snapshotTime: now() },
        ],
        children: [],
      },
    ],
  },
  {
    categoryId: 3,
    categoryName: '인터넷/플랫폼',
    totalMarketValue: 50_000_000_000_000,
    isExcluded: false,
    items: [
      { stockCode: '035420', stockName: 'NAVER', lastPrice: 198000, totalMarketValue: 32_000_000_000_000, marketValueTier: 'LARGE', changeRate: 0.3, currentPrice: 198000, snapshotTime: now() },
      { stockCode: '035720', stockName: '카카오', lastPrice: 41500, totalMarketValue: 18_000_000_000_000, marketValueTier: 'MID', changeRate: 3.4, currentPrice: 41500, snapshotTime: now() },
    ],
    children: [],
  },
]

export const excludedStocks: { stockCode: string; stockName: string }[] = []

// ── 마켓맵 어드민(신규 커스텀 시스템) ───────────────────────────────────
export const adminCategories = [
  { id: 1, name: '반도체', parentId: null, depth: 0 },
  { id: 2, name: '2차전지', parentId: null, depth: 0 },
  { id: 3, name: '인터넷/플랫폼', parentId: null, depth: 0 },
  { id: 4, name: '메모리', parentId: 1, depth: 1 },
  { id: 5, name: '파운드리', parentId: 1, depth: 1 },
  { id: 6, name: '양극재', parentId: 2, depth: 1 },
]

export const adminStockCategories: {
  stockCode: string
  market: 'KOSPI' | 'KOSDAQ'
  stockName: string
  alias: string | null
  totalMarketValue: number | null
  marketValueTier: 'MEGA' | 'LARGE' | 'MID' | 'SMALL' | null
  originCategoryName: string | null
  parentCategoryName: string | null
  categoryName: string
  categoryId: number
}[] = [
  {
    stockCode: '005930',
    market: 'KOSPI',
    stockName: '삼성전자',
    alias: null,
    totalMarketValue: 420_000_000_000_000,
    marketValueTier: 'MEGA',
    originCategoryName: '반도체와반도체장비',
    parentCategoryName: '반도체',
    categoryName: '메모리',
    categoryId: 4,
  },
  {
    stockCode: '000660',
    market: 'KOSPI',
    stockName: 'SK하이닉스',
    alias: null,
    totalMarketValue: 130_000_000_000_000,
    marketValueTier: 'MEGA',
    originCategoryName: '반도체와반도체장비',
    parentCategoryName: '반도체',
    categoryName: '파운드리',
    categoryId: 5,
  },
  {
    stockCode: '051910',
    market: 'KOSPI',
    stockName: 'LG화학',
    alias: null,
    totalMarketValue: 29_000_000_000_000,
    marketValueTier: 'LARGE',
    originCategoryName: '화학',
    parentCategoryName: '2차전지',
    categoryName: '양극재',
    categoryId: 6,
  },
  {
    stockCode: '373220',
    market: 'KOSPI',
    stockName: 'LG에너지솔루션',
    alias: 'LG엔솔',
    totalMarketValue: 93_000_000_000_000,
    marketValueTier: 'LARGE',
    originCategoryName: '전기장비',
    parentCategoryName: null,
    categoryName: '2차전지',
    categoryId: 2,
  },
  {
    stockCode: '035420',
    market: 'KOSPI',
    stockName: 'NAVER',
    alias: null,
    totalMarketValue: 32_000_000_000_000,
    marketValueTier: 'LARGE',
    originCategoryName: '소프트웨어',
    parentCategoryName: null,
    categoryName: '인터넷/플랫폼',
    categoryId: 3,
  },
  {
    stockCode: '035720',
    market: 'KOSDAQ',
    stockName: '카카오',
    alias: null,
    totalMarketValue: 18_000_000_000_000,
    marketValueTier: 'MID',
    originCategoryName: '소프트웨어',
    parentCategoryName: null,
    categoryName: '인터넷/플랫폼',
    categoryId: 3,
  },
]

export const adminVersions = [
  { id: 1, label: '2026-07-초안', createdAt: '2026-07-01T09:00:00', updatedAt: '2026-07-01T09:00:00' },
  { id: 2, label: '분기 정기 저장', createdAt: '2026-08-01T09:00:00', updatedAt: '2026-08-01T09:00:00' },
]

export const allowedIps = [
  { ip: '127.0.0.1', createdAt: now() },
  { ip: '10.0.0.5', createdAt: now() },
]
