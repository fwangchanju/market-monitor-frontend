// ─── Enums ───────────────────────────────────────────────────────────────────

export type Exchange = 'KOSPI' | 'KOSDAQ' | 'ALL'
export type MarketType = 'KOSPI' | 'KOSDAQ'
export type IntradayInvestorType =
  | 'FOREIGNER' | 'FOREIGN_COMPANY' | 'INSTITUTION'
  | 'PENSION_FUND' | 'TRUST' | 'FOREIGN_TOTAL'
export type InvestorType =
  | 'PERSONAL' | 'FOREIGNER' | 'INSTITUTION'
  | 'FINANCIAL_INVESTMENT' | 'TRUST' | 'PENSION_FUND'
  | 'PRIVATE_FUND' | 'INSURANCE' | 'BANK'
  | 'OTHER_CORP' | 'GOVERNMENT' | 'OTHER_FINANCE' | 'FOREIGN_COMPANY'
export type IntradayRankingType = 'NET_BUY' | 'NET_SELL'
export type ProgramRankingType = 'NET_BUY' | 'NET_SELL'

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface MarketOverviewItem {
  marketType: MarketType
  marketStatus: string
  indexValue: number
  changeValue: number
  changeRate: number
  tradingValue: number       // 백만 원
  upperLimitCount: number
  lowerLimitCount: number
  advancers: number
  decliners: number
  unchangedCount: number
}

export interface InvestorTradingSummaryItem {
  marketType: MarketType
  investorType: InvestorType
  buyAmount: number          // 억 원, 항상 0
  sellAmount: number         // 억 원, 항상 0
  netBuyAmount: number       // 억 원
}

export interface IntradayInvestorRankingItem {
  marketType: MarketType
  investorType: IntradayInvestorType
  rank: number
  stockCode: string
  stockName: string
  netBuyAmount: number       // 백만 원
  tradedVolume: number
}

export interface ProgramTradingRankingItem {
  rank: number
  stockCode: string
  stockName: string
  programBuyAmount: number    // 백만 원
  programSellAmount: number   // 백만 원
  programNetBuyAmount: number // 백만 원
}

export interface IndexContributionItem {
  marketType: MarketType
  rank: number
  stockCode: string
  stockName: string
  contributionScore: number
  priceChangeRate: number
}

export interface WatchStockItem {
  stockCode: string
  stockName: string
  marketType: MarketType
  isPrimary: boolean
}

export interface NotificationSettingResponse {
  userKey: string
  reminderEnabled: boolean
  reminderTime: string
  timezone: string
}

export interface DashboardResponse {
  snapshotTime: string | null
  lastCollectedAt: string | null
  marketStatus: string | null
  marketOverviews: MarketOverviewItem[]
  investorTradingSummaries: InvestorTradingSummaryItem[]
  intradayTopRankings: IntradayInvestorRankingItem[]
  programTradingHighlights: ProgramTradingRankingItem[]
  indexContributionHighlights: IndexContributionItem[]
  watchStocks: WatchStockItem[]
  notificationSetting: NotificationSettingResponse | null
}

// ─── Stock ───────────────────────────────────────────────────────────────────

export interface StockItem {
  stockCode: string
  stockName: string
  marketType: MarketType
}

// ─── Detail ──────────────────────────────────────────────────────────────────

export interface IntradayTopItem {
  stockCode: string
  stockName: string
  netBuyAmount: number   // 백만 원
}

export interface SnapshotResponse<T> {
  snapshotTime: string | null
  items: T[]
}

export interface StockHistoryResponse<T> {
  stockCode: string
  items: T[]
}

export interface ProgramTradingHistoryItem {
  snapshotTime: string
  programBuyAmount: number    // 백만 원
  programSellAmount: number   // 백만 원
  programNetBuyAmount: number // 백만 원
}

export interface ProgramTradingDailyItem {
  tradeDate: string
  programBuyAmount: number    // 백만 원
  programSellAmount: number   // 백만 원
  programNetBuyAmount: number // 백만 원
}

export interface ShortSellingHistoryItem {
  tradeDate: string
  snapshotTime: string | null
  closePrice: number
  priceChange: number
  changeRate: number
  tradingVolume: number
  shortVolume: number
  cumulativeShortVolume: number
  shortRatio: number
  shortAmount: number        // 천 원
  shortAvgPrice: number
}
