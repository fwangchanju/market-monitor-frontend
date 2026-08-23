import { useMemo } from 'react'
import { hierarchy, treemap, type HierarchyRectangularNode } from 'd3-hierarchy'
import type { MarketMapItem } from '@/types/api'

export interface DisplayGroup {
  categoryId: number
  categoryName: string
  totalMarketValue: number
  items: MarketMapItem[]
  children: DisplayGroup[]
}

interface LaidOutStockBox {
  item: MarketMapItem
  x: number
  y: number
  width: number
  height: number
  tooltipAlignLeft: boolean
  tooltipAlignTop: boolean
}

export interface LaidOutCategory {
  categoryId: number
  categoryName: string
  totalMarketValue: number
  isSelf: boolean
  x: number
  y: number
  width: number
  height: number
  boxes: LaidOutStockBox[]
  subCategories: LaidOutCategory[]
  tooltipAlignLeft: boolean
  tooltipAlignTop: boolean
}

interface HierarchyDatum {
  name: string
  categoryId?: number
  value?: number
  totalMarketValue?: number
  item?: MarketMapItem
  children?: HierarchyDatum[]
}

// 뎁스가 깊어질수록(세부 카테고리, 세부의 세부...) 헤더를 점점 작게 — MarketMapCategorySection의
// 실제 렌더링 높이도 이 함수를 그대로 써서 레이아웃 계산과 화면이 어긋나지 않게 한다.
// depth는 화면에 보이는 최상위 카테고리를 0으로 하는 렌더링 기준 depth.
export function categoryHeaderHeight(depth: number): number {
  return Math.max(28 - depth * 6, 16)
}
// 형제 카테고리끼리의 간격 — d3 treemap의 paddingInner(카테고리 자식을 둔 노드 기준).
// 카테고리 컴포넌트의 테두리(border-2, box-content로 바깥쪽에 그려짐)가 여기서 만든 간격을 파고들기 때문에,
// 테두리 두께(2px)보다 커야 실제로 여백이 남는다. 정확히 같으면 옆에 테두리 없는 종목 박스가 있을 때
// 간격이 전부 테두리에 먹혀서 다닥다닥 붙어 보인다.
export const CATEGORY_SIBLING_GAP = 4
// 형제 종목끼리의 간격 — 자식이 전부 종목(하위 카테고리가 하나도 없음)인 노드에서만 적용된다.
export const ITEM_SIBLING_GAP = 2
// 카테고리 컴포넌트 내부 — 자기 테두리와 그 안의 자식(하위 카테고리든 종목이든)들 사이의 여백 — d3
// treemap의 paddingOuter. MarketMapCategorySection도 이 값을 그대로 써서, 헤더 바를 자식들과
// 같은 폭만큼 안쪽으로 들여쓴다.
export const PADDING = 2
// 최상위 카테고리의 우측/하단 테두리가 컨테이너 너비/높이의 이 비율을 넘으면, 그 안의 모든 툴팁(카테고리/종목)을
// 각각 왼쪽/위쪽으로 뒤집는다. 실제 화면에서 툴팁이 잘리는지 보면서 이 값만 조정하면 됨
// (0.75 = 우측(혹은 하단) 25% 구간에 걸치면 반전).
const TOOLTIP_FLIP_EDGE_RATIO = 0.85

function toHierarchyDatum(group: DisplayGroup): HierarchyDatum {
  return {
    name: group.categoryName,
    categoryId: group.categoryId,
    totalMarketValue: group.totalMarketValue,
    children: [
      ...group.children.map(toHierarchyDatum),
      ...group.items.map(item => ({
        name: item.stockName,
        value: Math.max(item.totalMarketValue, 0),
        item,
      })),
    ],
  }
}

export function useMarketMapLayout(
  groups: DisplayGroup[],
  selfCategoryName: string | null,
  width: number,
  height: number,
): LaidOutCategory[] {
  return useMemo(() => {
    if (width <= 0 || height <= 0 || groups.length === 0) return []

    const data: HierarchyDatum = {
      name: 'root',
      children: groups.map(toHierarchyDatum),
    }

    const hierarchyRoot = hierarchy(data)
      .sum(d => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

    const totalValue = hierarchyRoot.value ?? 0
    if (totalValue <= 0) return []

    const root: HierarchyRectangularNode<HierarchyDatum> = treemap<HierarchyDatum>()
      .size([width, height])
      .paddingOuter(PADDING)
      // 자식이 전부 종목(하위 카테고리 없음)인 노드만 더 좁은 간격을 쓴다 — 카테고리와 종목이 섞여
      // 있으면 카테고리 헤더 쪽 여유가 더 필요하니 카테고리 기준 간격을 그대로 쓴다.
      .paddingInner(node =>
        (node.children ?? []).every(child => child.data.item) ? ITEM_SIBLING_GAP : CATEGORY_SIBLING_GAP,
      )
      // d3 계층에서 node.depth===0은 화면에 안 보이는 합성 root라, 화면 기준 depth로 맞추려면 -1.
      .paddingTop(node => (node.depth > 0 && !node.data.item ? categoryHeaderHeight(node.depth - 1) : 0))
      .round(true)(hierarchyRoot)

    const toLaidOutCategory = (
      node: HierarchyRectangularNode<HierarchyDatum>,
      originX: number,
      originY: number,
      tooltipAlignLeft: boolean,
      tooltipAlignTop: boolean,
    ): LaidOutCategory => {
      const nx0 = node.x0 ?? 0
      const ny0 = node.y0 ?? 0
      const boxes: LaidOutStockBox[] = []
      const subCategories: LaidOutCategory[] = []

      for (const child of node.children ?? []) {
        if (child.data.item) {
          boxes.push({
            item: child.data.item,
            x: (child.x0 ?? 0) - nx0,
            y: (child.y0 ?? 0) - ny0,
            width: (child.x1 ?? 0) - (child.x0 ?? 0),
            height: (child.y1 ?? 0) - (child.y0 ?? 0),
            tooltipAlignLeft,
            tooltipAlignTop,
          })
        } else {
          subCategories.push(toLaidOutCategory(child, nx0, ny0, tooltipAlignLeft, tooltipAlignTop))
        }
      }

      return {
        categoryId: node.data.categoryId ?? -1,
        categoryName: node.data.name,
        totalMarketValue: node.data.totalMarketValue ?? 0,
        isSelf: node.data.name === selfCategoryName,
        x: nx0 - originX,
        y: ny0 - originY,
        width: (node.x1 ?? 0) - nx0,
        height: (node.y1 ?? 0) - ny0,
        boxes,
        subCategories,
        tooltipAlignLeft,
        tooltipAlignTop,
      }
    }

    return (root.children ?? []).map(categoryNode => {
      const tooltipAlignLeft = (categoryNode.x1 ?? 0) > width * TOOLTIP_FLIP_EDGE_RATIO
      const tooltipAlignTop = (categoryNode.y1 ?? 0) > height * TOOLTIP_FLIP_EDGE_RATIO
      return toLaidOutCategory(categoryNode, 0, 0, tooltipAlignLeft, tooltipAlignTop)
    })
  }, [groups, selfCategoryName, width, height])
}
