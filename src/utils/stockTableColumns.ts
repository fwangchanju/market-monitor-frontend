// 커스텀 종목 표 열 너비(%) — MARKETRY 종목 표(AdminStockTable)와 한국거래소 종목 표(ReadOnlyHeatmapSheet)가 같은 너비를
// 쓰도록 한곳에 둔다. 두 표는 맨 왼쪽 체크박스 칸(고정 px)을 뺀 나머지 폭을 이 비율로 나눈다(합계 기준은 약칭 열이 있는
// 관리자 화면). 한국거래소 표의 "종목명"은 MARKETRY 표의 "종목명 + 약칭"과 같은 너비다.
export const STOCK_COLUMN_PERCENT = {
  stockCode: 7,
  stockName: 13,
  alias: 11,
  totalMarketValue: 11,
  market: 9,
  industry: 12,
  parentSector: 11,
  midSector: 11,
  subSector: 11,
} as const

export const STOCK_COLUMN_PERCENT_TOTAL = Object.values(STOCK_COLUMN_PERCENT).reduce((sum, value) => sum + value, 0)

// 체크박스 칸(고정 px)이 차지하는 몫을 빼고 남기는 비율 — 표 폭이 1200~1500px일 때 29px는 2~2.5%라서 97%로 잡는다.
// 표 칸 너비에는 calc()가 적용되지 않으므로 순수 퍼센트로 쓰고, 나머지 폭은 맨 오른쪽 열(width 없음)이 받는다.
const COLUMN_AREA_PERCENT = 97

export const stockColumnPercentWidth = (percent: number) => `${(percent / STOCK_COLUMN_PERCENT_TOTAL) * COLUMN_AREA_PERCENT}%`
