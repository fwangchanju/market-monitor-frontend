import { z } from 'zod'

// ─── Enums ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 타입 추출 전용, 실제 파싱엔 안 씀
const MarketQuerySchema = z.enum(['KOSPI', 'KOSDAQ', 'COMBINED'])
export type MarketQuery = z.infer<typeof MarketQuerySchema>

export const MarketSchema = z.enum(['KOSPI', 'KOSDAQ'])
export type Market = z.infer<typeof MarketSchema>

// 시가총액 구간 — 기준값(5천억/5조/200조)은 백엔드가 정의하는 도메인 분류라 백엔드가 계산해서 내려주고,
// 프론트는 이 값으로 필터링만 한다.
export const MarketValueTierSchema = z.enum(['MEGA', 'LARGE', 'MID', 'SMALL'])
export type MarketValueTier = z.infer<typeof MarketValueTierSchema>

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 타입 추출 전용, 실제 파싱엔 안 씀
const IntradayInvestorSchema = z.enum([
  'FOREIGNER', 'FOREIGN_COMPANY', 'INSTITUTION',
  'PENSION_FUND', 'TRUST', 'FOREIGN_TOTAL',
])
export type IntradayInvestor = z.infer<typeof IntradayInvestorSchema>

const InvestorSchema = z.enum([
  'PERSONAL', 'FOREIGNER', 'INSTITUTION',
  'FINANCIAL_INVESTMENT', 'TRUST', 'PENSION_FUND',
  'PRIVATE_FUND', 'INSURANCE', 'BANK',
  'OTHER_CORP', 'GOVERNMENT', 'OTHER_FINANCE', 'FOREIGN_COMPANY',
])
export type Investor = z.infer<typeof InvestorSchema>

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 타입 추출 전용, 실제 파싱엔 안 씀
const IntradayRankingSchema = z.enum(['NET_BUY', 'NET_SELL'])
export type IntradayRanking = z.infer<typeof IntradayRankingSchema>

export const ProgramRankingSchema = z.enum(['NET_BUY', 'NET_SELL'])
export type ProgramRanking = z.infer<typeof ProgramRankingSchema>

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 타입 추출 전용, 실제 파싱엔 안 씀
const AmtQtySchema = z.enum(['AMOUNT', 'QUANTITY'])
export type AmtQty = z.infer<typeof AmtQtySchema>

const RegisterBySchema = z.enum(['USER', 'HOLDINGS'])

// ─── Generic wrappers ─────────────────────────────────────────────────────────

export const snapshotResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    snapshotTime: z.string().nullable(),
    items: z.array(itemSchema),
  })

export const stockHistoryResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    stockCode: z.string().nullable(),
    snapshotTime: z.string().nullable(),
    items: z.array(itemSchema),
  })

// ─── Dashboard ───────────────────────────────────────────────────────────────

const MarketOverviewItemSchema = z.object({
  market: MarketSchema,
  marketStatus: z.string(),
  indexValue: z.number(),
  changeValue: z.number(),
  changeRate: z.number(),
  tradingValue: z.number(),       // 백만 원
  upperLimitCount: z.number(),
  lowerLimitCount: z.number(),
  advancers: z.number(),
  decliners: z.number(),
  unchangedCount: z.number(),
  snapshotTime: z.string(),
})

const InvestorTradingSummaryItemSchema = z.object({
  market: MarketSchema,
  investor: InvestorSchema,
  buyAmount: z.number(),          // 억 원, 항상 0
  sellAmount: z.number(),         // 억 원, 항상 0
  netBuyAmount: z.number(),       // 억 원
  snapshotTime: z.string(),
})

export const ProgramTradingRankingItemSchema = z.object({
  rank: z.number(),
  stockCode: z.string(),
  stockName: z.string(),
  programBuyAmount: z.number(),    // 백만 원
  programSellAmount: z.number(),   // 백만 원
  programNetBuyAmount: z.number(), // 백만 원
  snapshotTime: z.string(),
})
export type ProgramTradingRankingItem = z.infer<typeof ProgramTradingRankingItemSchema>

export const IndexContributionItemSchema = z.object({
  market: MarketSchema,
  rank: z.number(),
  stockCode: z.string(),
  stockName: z.string(),
  contributionScore: z.number(),
  priceChangeRate: z.number(),
  snapshotTime: z.string(),
})
export type IndexContributionItem = z.infer<typeof IndexContributionItemSchema>

export const WatchStockItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  market: MarketSchema,
  isMain: z.boolean(),
  registerBy: RegisterBySchema,
})

export const IntradayTopItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  netBuyAmount: z.number(),   // 백만 원
  snapshotTime: z.string(),
})
export type IntradayTopItem = z.infer<typeof IntradayTopItemSchema>

export const ProgramTradingHistoryItemSchema = z.object({
  snapshotTime: z.string(),
  programBuyAmount: z.number(),    // 백만 원
  programSellAmount: z.number(),   // 백만 원
  programNetBuyAmount: z.number(), // 백만 원
})
export type ProgramTradingHistoryItem = z.infer<typeof ProgramTradingHistoryItemSchema>

export const ShortSellingHistoryItemSchema = z.object({
  tradeDate: z.string(),
  closePrice: z.number(),
  priceChange: z.number(),
  changeRate: z.number(),
  tradingVolume: z.number(),
  shortVolume: z.number(),
  cumulativeShortVolume: z.number(),
  shortRatio: z.number(),
  shortAmount: z.number(),        // 천 원
  shortAvgPrice: z.number(),
})
export type ShortSellingHistoryItem = z.infer<typeof ShortSellingHistoryItemSchema>

// ─── Market summary (/market-summary) ─────────────────────────────────────────

export const MarketSummaryResponseSchema = z.object({
  marketOverviews: snapshotResponseSchema(MarketOverviewItemSchema),
  investorTradingSummaries: snapshotResponseSchema(InvestorTradingSummaryItemSchema),
  intradayTopRankings: snapshotResponseSchema(IntradayTopItemSchema),
  programTradingHighlights: snapshotResponseSchema(ProgramTradingRankingItemSchema),
  indexContributionHighlights: snapshotResponseSchema(IndexContributionItemSchema),
  mainShortSellingHistory: stockHistoryResponseSchema(ShortSellingHistoryItemSchema),
  mainProgramTradingHistory: stockHistoryResponseSchema(ProgramTradingHistoryItemSchema),
})

// ─── Stock ───────────────────────────────────────────────────────────────────

export const StockItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  market: MarketSchema,
})

// ─── Program trading (daily) ──────────────────────────────────────────────────

export const ProgramTradingDailyItemSchema = z.object({
  tradeDate: z.string(),
  programBuyAmount: z.number(),    // 백만 원
  programSellAmount: z.number(),   // 백만 원
  programNetBuyAmount: z.number(), // 백만 원
})
export type ProgramTradingDailyItem = z.infer<typeof ProgramTradingDailyItemSchema>

// ─── Market map ────────────────────────────────────────────────────────────────

const MarketMapItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  currentPrice: z.number(),     // 현재가, 원
  lastPrice: z.number(),        // 전일종가, 원
  totalMarketValue: z.number(), // 원
  marketValueTier: MarketValueTierSchema,
  changeRate: z.number(),
  snapshotTime: z.string(),
})
export type MarketMapItem = z.infer<typeof MarketMapItemSchema>

export interface MarketMapCategoryNode {
  categoryId: number
  categoryName: string
  totalMarketValue: number
  isExcluded: boolean
  children: MarketMapCategoryNode[]
  items: MarketMapItem[]
}

const MarketMapCategoryNodeSchema: z.ZodType<MarketMapCategoryNode> = z.lazy(() =>
  z.object({
    categoryId: z.number(),
    categoryName: z.string(),
    totalMarketValue: z.number(),
    isExcluded: z.boolean(),
    children: z.array(MarketMapCategoryNodeSchema),
    items: z.array(MarketMapItemSchema),
  }),
)

export const MarketMapResponseSchema = snapshotResponseSchema(MarketMapCategoryNodeSchema)

export const ExcludedStockItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
})

export const AllowedIpItemSchema = z.object({
  ip: z.string(),
  createdAt: z.string(),
})

export const CategoryItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  parentId: z.number().nullable(),
  depth: z.number(),
})
export type CategoryItem = z.infer<typeof CategoryItemSchema>

// GET /admin/market-map/stock-categories 응답 (백엔드 StockCategoryListItem)
export const StockCategoryListItemSchema = z.object({
  stockCode: z.string(),
  market: MarketSchema,
  stockName: z.string(),
  alias: z.string().nullable(),
  totalMarketValue: z.number().nullable(),
  marketValueTier: MarketValueTierSchema.nullable(),
  originCategoryName: z.string().nullable(),
  parentCategoryName: z.string().nullable(),
  categoryName: z.string(),
  categoryId: z.number(),
})
export type StockCategoryListItem = z.infer<typeof StockCategoryListItemSchema>

// PATCH /admin/market-map/stock-categories/bulk 응답. failedStockCodes가 비어있으면 전부 반영된 것.
export const BulkAssignResponseSchema = z.object({
  failedStockCodes: z.array(z.string()),
  categoryId: z.number(),
})
export type BulkAssignResponse = z.infer<typeof BulkAssignResponseSchema>

// delete-preview API의 blockingStocks 항목 (백엔드 StockCategoryItem — 위 StockCategoryListItem과는
// 다른 타입이라 market/totalMarketValue/parentCategoryName이 없음)
export const StockCategoryItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  categoryName: z.string(),
})
export type StockCategoryItem = z.infer<typeof StockCategoryItemSchema>

export const CategoryDeletePreviewSchema = z.object({
  categoryName: z.string(),
  deletable: z.boolean(),
  blockingStocks: z.array(StockCategoryItemSchema),
  deletableCategories: z.array(z.string()),
})

export const VersionItemSchema = z.object({
  id: z.number(),
  label: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
