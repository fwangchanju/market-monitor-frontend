import { useEffect, useMemo } from 'react'
import { usePersistedState } from './usePersistedState'
import { useMarketValueTiers } from './useMarketValueTiers'
import { defaultExcludedTierLabels, tierRangeToExcludedLabels } from '@/utils/marketValueTier'

const MIN_INDEX_KEY = 'marketMap.tierRangeMinIndex'
const MAX_INDEX_KEY = 'marketMap.tierRangeMaxIndex'

// 시가총액 구간(오름차순 tiers 배열 기준) 범위 필터 — 마켓맵 화면과 카테고리 랭킹 화면이 세션스토리지
// 키를 그대로 공유해서, 한쪽에서 바꾼 토글 상태가 다른 화면에도 항상 똑같이 반영된다(두 화면 모두
// 배포 전 운영 수치와 일치해야 한다는 요구사항 때문에 상태를 분리해두면 안 됨).
// enabled=false면(예: 기본 분류 트리 모드) 필터 자체를 적용하지 않는다.
export function useMarketValueTierRange(enabled: boolean) {
  const { data: valueTiersData } = useMarketValueTiers()
  const tiers = useMemo(() => valueTiersData ?? [], [valueTiersData])

  // -1 = tiers를 아직 못 받아와서 기본값을 못 정한 상태. tiers가 도착하면 아래 useEffect가
  // isExcludedByDefault 기준으로 딱 한 번만 채운다(이미 세션에 저장된 값이 있으면 건드리지 않음).
  const [minIndex, setMinIndex] = usePersistedState(MIN_INDEX_KEY, -1)
  const [maxIndex, setMaxIndex] = usePersistedState(MAX_INDEX_KEY, -1)

  useEffect(() => {
    if (minIndex !== -1 || tiers.length === 0) return
    const excludedLabels = defaultExcludedTierLabels(tiers)
    const firstIncludedIndex = tiers.findIndex(tier => !excludedLabels.has(tier.label))
    const lastIncludedIndex = tiers.findLastIndex(tier => !excludedLabels.has(tier.label))
    setMinIndex(firstIncludedIndex === -1 ? 0 : firstIncludedIndex)
    setMaxIndex(lastIncludedIndex === -1 ? tiers.length - 1 : lastIncludedIndex)
  }, [tiers, minIndex, setMinIndex, setMaxIndex])

  const excludedMarketValueTiers = useMemo(
    () =>
      enabled && tiers.length > 0 && minIndex !== -1
        ? tierRangeToExcludedLabels(tiers, minIndex, maxIndex)
        : new Set<string>(),
    [enabled, tiers, minIndex, maxIndex],
  )

  return { tiers, minIndex, maxIndex, setMinIndex, setMaxIndex, excludedMarketValueTiers }
}
