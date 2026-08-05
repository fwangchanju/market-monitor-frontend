import { useState } from 'react'
import type { MarketMapCategoryNode } from '@/types/api'

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

  const enterCategory = (categoryName: string) => setPath(prev => [...prev, categoryName])
  const goBack = () => setPath(prev => prev.slice(0, -1))
  const goToDepth = (depth: number) => setPath(prev => prev.slice(0, depth))
  const reset = () => setPath([])

  return { path, currentNode, currentSiblings, enterCategory, goBack, goToDepth, reset }
}
