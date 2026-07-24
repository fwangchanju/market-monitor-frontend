import { z } from 'zod'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const MarketQuerySchema = z.enum(['KOSPI', 'KOSDAQ', 'COMBINED'])
export type MarketQuery = z.infer<typeof MarketQuerySchema>

export const MarketSchema = z.enum(['KOSPI', 'KOSDAQ'])
export type Market = z.infer<typeof MarketSchema>

export const IntradayInvestorSchema = z.enum([
  'FOREIGNER', 'FOREIGN_COMPANY', 'INSTITUTION',
  'PENSION_FUND', 'TRUST', 'FOREIGN_TOTAL',
])
export type IntradayInvestor = z.infer<typeof IntradayInvestorSchema>

export const InvestorSchema = z.enum([
  'PERSONAL', 'FOREIGNER', 'INSTITUTION',
  'FINANCIAL_INVESTMENT', 'TRUST', 'PENSION_FUND',
  'PRIVATE_FUND', 'INSURANCE', 'BANK',
  'OTHER_CORP', 'GOVERNMENT', 'OTHER_FINANCE', 'FOREIGN_COMPANY',
])
export type Investor = z.infer<typeof InvestorSchema>

export const IntradayRankingSchema = z.enum(['NET_BUY', 'NET_SELL'])
export type IntradayRanking = z.infer<typeof IntradayRankingSchema>

export const ProgramRankingSchema = z.enum(['NET_BUY', 'NET_SELL'])
export type ProgramRanking = z.infer<typeof ProgramRankingSchema>

export const AmtQtySchema = z.enum(['AMOUNT', 'QUANTITY'])
export type AmtQty = z.infer<typeof AmtQtySchema>

export const RegisterBySchema = z.enum(['USER', 'HOLDINGS'])
export type RegisterBy = z.infer<typeof RegisterBySchema>

// ─── Generic wrappers ─────────────────────────────────────────────────────────

export const snapshotResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    snapshotTime: z.string().nullable(),
    items: z.array(itemSchema),
  })
export type SnapshotResponse<T> = {
  snapshotTime: string | null
  items: T[]
}

export const stockHistoryResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    stockCode: z.string().nullable(),
    snapshotTime: z.string().nullable(),
    items: z.array(itemSchema),
  })
export type StockHistoryResponse<T> = {
  stockCode: string | null
  snapshotTime: string | null
  items: T[]
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const MarketOverviewItemSchema = z.object({
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
export type MarketOverviewItem = z.infer<typeof MarketOverviewItemSchema>

export const InvestorTradingSummaryItemSchema = z.object({
  market: MarketSchema,
  investor: InvestorSchema,
  buyAmount: z.number(),          // 억 원, 항상 0
  sellAmount: z.number(),         // 억 원, 항상 0
  netBuyAmount: z.number(),       // 억 원
  snapshotTime: z.string(),
})
export type InvestorTradingSummaryItem = z.infer<typeof InvestorTradingSummaryItemSchema>

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
export type WatchStockItem = z.infer<typeof WatchStockItemSchema>

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
  snapshotTime: z.string().nullable(),
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
export type MarketSummaryResponse = z.infer<typeof MarketSummaryResponseSchema>

// ─── Stock ───────────────────────────────────────────────────────────────────

export const StockItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  market: MarketSchema,
})
export type StockItem = z.infer<typeof StockItemSchema>

// ─── Program trading (daily) ──────────────────────────────────────────────────

export const ProgramTradingDailyItemSchema = z.object({
  tradeDate: z.string(),
  programBuyAmount: z.number(),    // 백만 원
  programSellAmount: z.number(),   // 백만 원
  programNetBuyAmount: z.number(), // 백만 원
})
export type ProgramTradingDailyItem = z.infer<typeof ProgramTradingDailyItemSchema>

// ─── Market map ────────────────────────────────────────────────────────────────

export const MarketMapItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  lastPrice: z.number(),        // 전일종가, 원
  totalMarketValue: z.number(), // 원
  changeRate: z.number(),
  snapshotTime: z.string(),
})
export type MarketMapItem = z.infer<typeof MarketMapItemSchema>

export const MarketMapCategoryGroupSchema = z.object({
  categoryName: z.string(),
  items: z.array(MarketMapItemSchema),
})
export type MarketMapCategoryGroup = z.infer<typeof MarketMapCategoryGroupSchema>

export const MarketMapResponseSchema = snapshotResponseSchema(MarketMapCategoryGroupSchema)
export type MarketMapResponse = z.infer<typeof MarketMapResponseSchema>

export const ExcludedStockItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
})
export type ExcludedStockItem = z.infer<typeof ExcludedStockItemSchema>

export const StockCategoryItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  categoryName: z.string(),
})
export type StockCategoryItem = z.infer<typeof StockCategoryItemSchema>

export const AllowedIpItemSchema = z.object({
  ip: z.string(),
  createdAt: z.string(),
})
export type AllowedIpItem = z.infer<typeof AllowedIpItemSchema>
