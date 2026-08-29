import type { CategoryTierBreakdown } from '@/types/api'

export interface CombinedChangeRate {
  weightedAvg: number | null
  simpleAvg: number | null
}

// 여러 시가총액 구간의 등락률 원시 합계(분자/분모)를 합산한 뒤 마지막에 한 번만 나눈다 — 이미 나뉜
// 구간별 평균끼리 다시 평균내면 구간별 종목 수/시총 비중을 알 수 없어 틀리기 때문에, 반드시 이 순서를
// 지켜야 한다. 지도 화면(카테고리 태그)과 랭킹 화면이 공통으로 쓴다.
export function combineTierBreakdowns(
  breakdowns: CategoryTierBreakdown[],
  excludedTierLabels: Set<string>,
): CombinedChangeRate {
  let weightedSum = 0
  let totalValue = 0
  let simpleSum = 0
  let itemCount = 0
  for (const breakdown of breakdowns) {
    if (excludedTierLabels.has(breakdown.tierLabel)) continue
    weightedSum += breakdown.weightedSum
    totalValue += breakdown.totalValue
    simpleSum += breakdown.simpleSum
    itemCount += breakdown.itemCount
  }
  return {
    weightedAvg: totalValue > 0 ? weightedSum / totalValue : null,
    simpleAvg: itemCount > 0 ? simpleSum / itemCount : null,
  }
}
