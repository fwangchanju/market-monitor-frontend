// ─── Enums ───────────────────────────────────────────────────────────────────

export type MarketQuery = 'KOSPI' | 'KOSDAQ' | 'COMBINED'
export type Market = 'KOSPI' | 'KOSDAQ'
export type IntradayInvestor =
  | 'FOREIGNER' | 'FOREIGN_COMPANY' | 'INSTITUTION'
  | 'PENSION_FUND' | 'TRUST' | 'FOREIGN_TOTAL'
export type Investor =
  | 'PERSONAL' | 'FOREIGNER' | 'INSTITUTION'
  | 'FINANCIAL_INVESTMENT' | 'TRUST' | 'PENSION_FUND'
  | 'PRIVATE_FUND' | 'INSURANCE' | 'BANK'
  | 'OTHER_CORP' | 'GOVERNMENT' | 'OTHER_FINANCE' | 'FOREIGN_COMPANY'
export type IntradayRanking = 'NET_BUY' | 'NET_SELL'
export type ProgramRanking = 'NET_BUY' | 'NET_SELL'
export type AmtQty = 'AMOUNT' | 'QUANTITY'

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface MarketOverviewItem {
  market: Market
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
  market: Market
  investor: Investor
  buyAmount: number          // 억 원, 항상 0
  sellAmount: number         // 억 원, 항상 0
  netBuyAmount: number       // 억 원
}

export interface IntradayInvestorRankingItem {
  market: Market
  investor: IntradayInvestor
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
  market: Market
  rank: number
  stockCode: string
  stockName: string
  contributionScore: number
  priceChangeRate: number
}

export interface WatchStockItem {
  stockCode: string
  stockName: string
  market: Market
  isMain: boolean
}

// ─── Market summary (/market-summary) ─────────────────────────────────────────

export interface MarketSummaryResponse {
  marketOverviews: SnapshotResponse<MarketOverviewItem>
  investorTradingSummaries: SnapshotResponse<InvestorTradingSummaryItem>
  intradayTopRankings: SnapshotResponse<IntradayInvestorRankingItem>
  programTradingHighlights: SnapshotResponse<ProgramTradingRankingItem>
  indexContributionHighlights: SnapshotResponse<IndexContributionItem>
}

// ─── Stock ───────────────────────────────────────────────────────────────────

export interface StockItem {
  stockCode: string
  stockName: string
  market: Market
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
