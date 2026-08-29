import { useMemo } from 'react'
import type { MarketMapCategoryNode, MarketMapItem } from '@/types/api'
import { combineTierBreakdowns } from '@/utils/categoryTierBreakdown'

// 필터링(카테고리 제외/시가총액 구간)까지 반영된 뒤에도 화면이 필요로 하는 등락률 평균 두 개를 들고
// 있는 노드 — tierBreakdown을 매번 다시 조합하지 않도록 필터링 시점에 한 번만 계산해서 붙여둔다.
// weightedAvgChangeRate/simpleAvgChangeRate가 null이면 스냅샷이 없거나(기본 마켓맵) 지금 선택된
// 구간에 해당하는 종목이 하나도 없다는 뜻 — MarketMapCategorySection이 그 경우 items 기준 실시간
// 계산으로 대체한다.
export interface FilteredMarketMapCategoryNode extends MarketMapCategoryNode {
  weightedAvgChangeRate: number | null
  simpleAvgChangeRate: number | null
  children: FilteredMarketMapCategoryNode[]
}

// 카테고리 exclude는 하위 전체로 자동 전파된다 — 제외된 노드는 자식을 아예 살펴보지 않고 통째로 버리므로,
// 자식이 스스로 isExcluded=false여도 부모가 제외되면 같이 사라진다.
// 시총 0(또는 tier로 다 걸러진) 종목/카테고리는 트리맵에 빈 슬리버로 남지 않도록 재귀적으로 가지치기한다.
function filterNodes(
  nodes: MarketMapCategoryNode[],
  excludedCategoryIds: Set<number>,
  excludedMarketValueTiers: Set<string>,
): FilteredMarketMapCategoryNode[] {
  const result: FilteredMarketMapCategoryNode[] = []
  for (const node of nodes) {
    if (excludedCategoryIds.has(node.categoryId)) continue

    const items = node.items.filter(
      item => item.totalMarketValue > 0 && !excludedMarketValueTiers.has(item.marketValueTier),
    )
    const children = filterNodes(node.children, excludedCategoryIds, excludedMarketValueTiers)
    const totalMarketValue =
      items.reduce((sum, item) => sum + item.totalMarketValue, 0) +
      children.reduce((sum, child) => sum + child.totalMarketValue, 0)
    if (totalMarketValue <= 0) continue

    const { weightedAvg, simpleAvg } = combineTierBreakdowns(node.tierBreakdown, excludedMarketValueTiers)
    result.push({
      ...node,
      items,
      children,
      totalMarketValue,
      weightedAvgChangeRate: weightedAvg,
      simpleAvgChangeRate: simpleAvg,
    })
  }
  return result
}

// depth === maxDepth인 노드는 이 뎁스까지만 태그를 보여준다는 뜻 — 그 밑에 있던 하위 카테고리들의
// 태그(헤더)는 없애되, 안에 있던 종목은 사라지지 않고 전부 이 노드 박스 안으로 펼쳐서 보여준다.
function collectAllItems(node: FilteredMarketMapCategoryNode): MarketMapItem[] {
  const items = [...node.items]
  for (const child of node.children) items.push(...collectAllItems(child))
  return items
}

// depth는 루트로 넘어온 nodes를 1로 보는 화면 기준(= "분류 단계" 슬라이더 값과 동일 단위).
function limitDepth(
  nodes: FilteredMarketMapCategoryNode[],
  maxDepth: number,
  depth = 1,
): FilteredMarketMapCategoryNode[] {
  const result: FilteredMarketMapCategoryNode[] = []
  for (const node of nodes) {
    if (depth >= maxDepth) {
      const items = collectAllItems(node)
      const totalMarketValue = items.reduce((sum, item) => sum + item.totalMarketValue, 0)
      if (totalMarketValue <= 0) continue
      result.push({ ...node, items, children: [], totalMarketValue })
      continue
    }
    const children = limitDepth(node.children, maxDepth, depth + 1)
    const totalMarketValue =
      node.items.reduce((sum, item) => sum + item.totalMarketValue, 0) +
      children.reduce((sum, child) => sum + child.totalMarketValue, 0)
    if (totalMarketValue <= 0) continue
    result.push({ ...node, children, totalMarketValue })
  }
  return result
}

function computeMaxDepth(nodes: FilteredMarketMapCategoryNode[], depth = 1): number {
  let max = depth
  for (const node of nodes) {
    if (node.children.length > 0) max = Math.max(max, computeMaxDepth(node.children, depth + 1))
  }
  return max
}

export function useFilteredMarketMapTree(
  rootNodes: MarketMapCategoryNode[],
  excludedCategoryIds: Set<number>,
  excludedMarketValueTiers: Set<string>,
  maxDepth: number | null,
) {
  const excludeTierFiltered = useMemo(
    () => filterNodes(rootNodes, excludedCategoryIds, excludedMarketValueTiers),
    [rootNodes, excludedCategoryIds, excludedMarketValueTiers],
  )
  // 슬라이더 상한 — exclude/tier 필터링까지 반영된 트리 기준으로, 실제로 의미 있는 뎁스만 센다.
  const availableMaxDepth = useMemo(() => computeMaxDepth(excludeTierFiltered), [excludeTierFiltered])
  const filteredRootNodes = useMemo(
    () => (maxDepth != null && maxDepth < availableMaxDepth ? limitDepth(excludeTierFiltered, maxDepth) : excludeTierFiltered),
    [excludeTierFiltered, maxDepth, availableMaxDepth],
  )
  return { filteredRootNodes, availableMaxDepth }
}
