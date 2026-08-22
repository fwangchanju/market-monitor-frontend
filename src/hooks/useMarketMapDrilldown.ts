import { useState } from 'react'
import type { MarketMapCategoryNode } from '@/types/api'

// 카테고리 이름은 DB에서 전체 유일(uk_market_map_category_name)이 보장되므로, 트리 전체를 뒤져서
// 루트부터 해당 이름까지의 전체 경로를 찾을 수 있다. "전체" 화면에서는 세부 카테고리 헤더가 이미
// 중첩 렌더링돼있어 부모를 거치지 않고 바로 클릭할 수 있는데, 그 경우에도 조상 이름이 빠지지 않게
// 클릭한 이름 하나만 쌓는 대신 이 전체 경로로 교체해야 한다.
function findPathToCategory(nodes: MarketMapCategoryNode[], targetName: string, ancestors: string[] = []): string[] | null {
  for (const node of nodes) {
    const path = [...ancestors, node.categoryName]
    if (node.categoryName === targetName) return path
    const found = findPathToCategory(node.children, targetName, path)
    if (found) return found
  }
  return null
}

export function useMarketMapDrilldown(rootNodes: MarketMapCategoryNode[]) {
  const [path, setPath] = useState<string[]>([])

  let currentNode: MarketMapCategoryNode | null = null
  let currentSiblings = rootNodes
  for (const name of path) {
    const found = currentSiblings.find(n => n.categoryName === name)
    if (!found) break
    currentNode = found
    currentSiblings = found.children
  }

  const enterCategory = (categoryName: string) => {
    const fullPath = findPathToCategory(rootNodes, categoryName)
    if (fullPath) setPath(fullPath)
  }
  const goBack = () => setPath(prev => prev.slice(0, -1))
  const goToDepth = (depth: number) => setPath(prev => prev.slice(0, depth))
  const reset = () => setPath([])

  return { path, currentNode, currentSiblings, enterCategory, goBack, goToDepth, reset }
}
