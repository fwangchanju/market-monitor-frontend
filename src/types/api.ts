import { z } from 'zod'

// ─── Enums ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 타입 추출 전용, 실제 파싱엔 안 씀
const MarketQuerySchema = z.enum(['KOSPI', 'KOSDAQ', 'COMBINED'])
export type MarketQuery = z.infer<typeof MarketQuerySchema>

export const MarketSchema = z.enum(['KOSPI', 'KOSDAQ'])
export type Market = z.infer<typeof MarketSchema>

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

// 시가총액 구간(초대형주/대형주/...) 정의 — 코드 enum이 아니라 GET /market-map/value-tiers로 조회한다.
// thresholdValue 오름차순 정렬로 내려온다. isExcludedByDefault는 화면 진입 시 필터 토글의 초기값일 뿐,
// 이후 토글 상태는 프론트가 직접 관리한다(백엔드에 다시 물어보지 않음).
export const MarketValueTierItemSchema = z.object({
  id: z.number(),
  label: z.string(),
  thresholdValue: z.number(),
  isExcludedByDefault: z.boolean(),
})
export type MarketValueTierItem = z.infer<typeof MarketValueTierItemSchema>
export const MarketValueTierListResponseSchema = z.array(MarketValueTierItemSchema)

const MarketMapItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  currentPrice: z.number(),     // 현재가, 원
  lastPrice: z.number(),        // 전일종가, 원
  totalMarketValue: z.number(), // 원
  marketValueTier: z.string(),
  changeRate: z.number(),
  snapshotTime: z.string(),
})
export type MarketMapItem = z.infer<typeof MarketMapItemSchema>

// 카테고리(하위 카테고리 재귀 포함) 하나의, 시가총액 구간 하나에 대한 등락률 원시 합계(분자/분모) —
// 이미 나눠진 평균이 아니다. 필터(어떤 구간을 포함할지)는 화면이 알고 있으므로, 원하는 구간들만 골라
// weightedSum/totalValue, simpleSum/itemCount를 각각 합산한 뒤 마지막에 한 번만 나눠야 한다
// (이미 나뉜 구간별 평균끼리 다시 평균내면 틀림) — utils/categoryTierBreakdown.ts의 combineTierBreakdowns 참고.
export const CategoryTierBreakdownSchema = z.object({
  tierId: z.number(),
  tierLabel: z.string(),
  weightedSum: z.number(),
  totalValue: z.number(),
  simpleSum: z.number(),
  itemCount: z.number(),
})
export type CategoryTierBreakdown = z.infer<typeof CategoryTierBreakdownSchema>

export interface MarketMapCategoryNode {
  categoryId: number
  categoryName: string
  totalMarketValue: number
  isExcluded: boolean
  // 이 카테고리(하위 카테고리 포함) 최신 스냅샷 기준, 시가총액 구간별 등락률 원시 합계. 아직 스냅샷이
  // 없는 카테고리(기본 마켓맵 노드 포함)는 빈 배열.
  tierBreakdown: CategoryTierBreakdown[]
  children: MarketMapCategoryNode[]
  items: MarketMapItem[]
}

const MarketMapCategoryNodeSchema: z.ZodType<MarketMapCategoryNode> = z.lazy(() =>
  z.object({
    categoryId: z.number(),
    categoryName: z.string(),
    totalMarketValue: z.number(),
    isExcluded: z.boolean(),
    tierBreakdown: z.array(CategoryTierBreakdownSchema),
    children: z.array(MarketMapCategoryNodeSchema),
    items: z.array(MarketMapItemSchema),
  }),
)

export const MarketMapResponseSchema = snapshotResponseSchema(MarketMapCategoryNodeSchema)

// ─── Market map category change-rate ranking (/market-map/category-change-rates) ─────

export const CategoryChangeRateItemSchema = z.object({
  categoryId: z.number(),
  now: z.array(CategoryTierBreakdownSchema),
  // 60분 전 시점 데이터가 없으면(장 시작 직후 등) null — 조용히 다른 시점으로 대체하지 않는다.
  before: z.array(CategoryTierBreakdownSchema).nullable(),
})
export type CategoryChangeRateItem = z.infer<typeof CategoryChangeRateItemSchema>

export const CategoryChangeRateResponseSchema = snapshotResponseSchema(CategoryChangeRateItemSchema)

// 박스/범례 등락률 컬러 스케일의 기준값 하나(admin이 개별 CRUD하는 단위) — src/utils/marketMapColorScale.ts 참고.
// side는 별도 필드로 두지 않고 thresholdPercent의 부호로 표현한다(음수=하락, 0=기준, 양수=상승).
// id는 서버가 발급 — 로컬에서 막 추가해서 아직 서버에 반영 안 된 행은 id가 없다(생성 응답으로 받기 전까지).
// colorLabel은 백엔드에서 ColorTone enum(RED/ORANGE/...)이라 대문자로 오는데, 프론트 내부(톤 프리셋
// 버튼 이름 비교 등)는 전부 소문자 기준이라 파싱 시점에 소문자로 변환해서 그 차이를 여기서 흡수한다.
export const MarketMapScaleThresholdSchema = z.object({
  id: z.number(),
  thresholdPercent: z.number(),
  color: z.string(),
  colorLabel: z
    .string()
    .nullable()
    .transform(v => v?.toLowerCase() ?? null),
})
export type MarketMapScaleThreshold = z.infer<typeof MarketMapScaleThresholdSchema>

// GET /market-map/scale 응답
export const MarketMapScaleResponseSchema = z.object({
  thresholds: z.array(MarketMapScaleThresholdSchema),
})
export type MarketMapScaleResponse = z.infer<typeof MarketMapScaleResponseSchema>

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
  marketValueTier: z.string().nullable(),
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
