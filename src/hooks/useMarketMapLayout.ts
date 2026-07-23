import { useMemo } from 'react'
import { hierarchy, treemap, type HierarchyRectangularNode } from 'd3-hierarchy'
import type { MarketMapCategoryGroup, MarketMapItem } from '@/types/api'

export interface LaidOutStockBox {
  item: MarketMapItem
  x: number
  y: number
  width: number
  height: number
  share: number
}

export interface LaidOutCategory {
  categoryName: string
  x: number
  y: number
  width: number
  height: number
  boxes: LaidOutStockBox[]
}

interface HierarchyDatum {
  name: string
  value?: number
  item?: MarketMapItem
  children?: HierarchyDatum[]
}

const CATEGORY_HEADER_HEIGHT = 28
const PADDING = 2

export function useMarketMapLayout(
  groups: MarketMapCategoryGroup[],
  width: number,
  height: number,
): LaidOutCategory[] {
  return useMemo(() => {
    if (width <= 0 || height <= 0 || groups.length === 0) return []

    const data: HierarchyDatum = {
      name: 'root',
      children: groups.map(group => ({
        name: group.categoryName,
        children: group.items.map(item => ({
          name: item.stockName,
          value: Math.max(item.totalMarketValue, 0),
          item,
        })),
      })),
    }

    const hierarchyRoot = hierarchy(data)
      .sum(d => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

    const totalValue = hierarchyRoot.value ?? 0
    if (totalValue <= 0) return []

    const root: HierarchyRectangularNode<HierarchyDatum> = treemap<HierarchyDatum>()
      .size([width, height])
      .paddingOuter(PADDING)
      .paddingInner(PADDING)
      .paddingTop(node => (node.depth === 1 ? CATEGORY_HEADER_HEIGHT : 0))
      .round(true)(hierarchyRoot)

    const categoryNodes = root.children ?? []

    return categoryNodes.map(categoryNode => {
      const cx0 = categoryNode.x0 ?? 0
      const cy0 = categoryNode.y0 ?? 0
      return {
        categoryName: categoryNode.data.name,
        x: cx0,
        y: cy0,
        width: (categoryNode.x1 ?? 0) - cx0,
        height: (categoryNode.y1 ?? 0) - cy0,
        boxes: (categoryNode.children ?? []).map(leaf => ({
          item: leaf.data.item as MarketMapItem,
          x: (leaf.x0 ?? 0) - cx0,
          y: (leaf.y0 ?? 0) - cy0,
          width: (leaf.x1 ?? 0) - (leaf.x0 ?? 0),
          height: (leaf.y1 ?? 0) - (leaf.y0 ?? 0),
          share: (leaf.value ?? 0) / totalValue,
        })),
      }
    })
  }, [groups, width, height])
}
