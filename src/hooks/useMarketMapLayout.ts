import { useMemo } from 'react'
import { hierarchy, treemap, type HierarchyRectangularNode } from 'd3-hierarchy'
import type { MarketMapItem } from '@/types/api'

export interface DisplayGroup {
  sectorId: number
  sectorName: string
  totalMarketValue: number
  weightedAvgChangeRate: number | null
  simpleAvgChangeRate: number | null
  items: MarketMapItem[]
  children: DisplayGroup[]
}

interface LaidOutStockBox {
  item: MarketMapItem
  x: number
  y: number
  width: number
  height: number
  // 이 박스 넓이가 전체 트리맵 컨테이너 넓이에서 차지하는 비중(%) — 섹터 뎁스와 무관하게 항상
  // 최상위 컨테이너 기준(d3 treemap이 전체 트리를 한 좌표계에서 배치하므로, 어느 뎁스의 박스든
  // width*height를 컨테이너 전체 width*height로 나누면 바로 이 비중이 나온다).
  areaPercent: number
}

export interface LaidOutSector {
  sectorId: number
  sectorName: string
  totalMarketValue: number
  weightedAvgChangeRate: number | null
  simpleAvgChangeRate: number | null
  isSelf: boolean
  x: number
  y: number
  width: number
  height: number
  boxes: LaidOutStockBox[]
  subSectors: LaidOutSector[]
}

interface HierarchyDatum {
  name: string
  sectorId?: number
  value?: number
  totalMarketValue?: number
  weightedAvgChangeRate?: number | null
  simpleAvgChangeRate?: number | null
  item?: MarketMapItem
  children?: HierarchyDatum[]
}

// 대분류/중분류/소분류 순서로 점점 작게 — 그 이하 뎁스는 소분류와 동일(마지막 값 반복).
const SECTOR_HEADER_FONT_SIZES = [15, 12, 10]
// depth는 화면에 보이는 최상위 섹터를 0으로 하는 렌더링 기준 depth.
export function sectorHeaderFontSize(depth: number): number {
  return SECTOR_HEADER_FONT_SIZES[Math.min(depth, SECTOR_HEADER_FONT_SIZES.length - 1)]
}

// 헤더 높이는 폰트 크기에 항상 비례한다 — 원래 대분류 폰트가 16px일 때 높이가 28px이었던 비율(1.75배)을
// 그대로 기준 삼아, 지금 폰트 크기(SECTOR_HEADER_FONT_SIZES)가 얼마든 그 비율만큼의 높이를 준다. 폰트
// 크기를 바꾸면 높이도 자동으로 같은 비율로 줄어들거나 커지는 구조. MarketMapSectorSection의 실제
// 렌더링 높이도 이 함수를 그대로 써서 레이아웃 계산과 화면이 어긋나지 않게 한다.
const SECTOR_HEADER_HEIGHT_RATIO = 20 / 16
// 비율 계산 결과에서 모든 뎁스 공통으로 1px씩 뺀다 — 대분류/중분류/소분류 헤더를 전체적으로 살짝
// 더 얇게 보이게 하려는 조정.
const SECTOR_HEADER_HEIGHT_ADJUSTMENT = -1
export function sectorHeaderHeight(depth: number): number {
  return Math.round(sectorHeaderFontSize(depth) * SECTOR_HEADER_HEIGHT_RATIO) + SECTOR_HEADER_HEIGHT_ADJUSTMENT
}
// 형제 섹터끼리의 간격 — d3 treemap의 paddingInner(섹터 자식을 둔 노드 기준).
export const SECTOR_SIBLING_GAP = 5
// 형제 종목끼리의 간격 — 자식이 전부 종목(하위 섹터가 하나도 없음)인 노드에서만 적용된다.
// 종목은 border-box라 테두리가 안쪽으로 그려지므로 간격을 테두리 두께만큼만 둬도 안 겹친다.
export const ITEM_SIBLING_GAP = 1
// 섹터 컴포넌트 내부 — 자기 테두리와 그 안의 자식(하위 섹터든 종목이든)들 사이의 여백 — d3
// treemap의 paddingOuter. MarketMapSectorSection도 이 값을 그대로 써서, 헤더 바를 자식들과
// 같은 폭만큼 안쪽으로 들여쓴다. 0이라 자식이 섹터면 그 테두리가 부모 테두리와 같은 자리에
// 겹치는데, 형제 간격(SECTOR_SIBLING_GAP)과 같은 이유로 문제없다(평소엔 같은 색이라 한 줄처럼
// 보이고, hover 중인 쪽은 z-index로 항상 위에 그려짐). 상단 헤더 공간은 paddingTop으로 별도 처리.
export const PADDING = 0

// 시총 반영 비율을 0~100 지수로 변환한다. 0은 종목별 동일 크기, 100은 시가총액 비례,
// 중간은 거듭제곱으로 시총 격차를 압축한다(예: 50이면 제곱근 비율).
function boxValue(totalMarketValue: number, marketCapRatio: number): number {
  if (marketCapRatio <= 0) return 1
  return Math.pow(Math.max(totalMarketValue, 0), marketCapRatio / 100)
}

function toHierarchyDatum(group: DisplayGroup, marketCapRatio: number): HierarchyDatum {
  return {
    name: group.sectorName,
    sectorId: group.sectorId,
    totalMarketValue: group.totalMarketValue,
    weightedAvgChangeRate: group.weightedAvgChangeRate,
    simpleAvgChangeRate: group.simpleAvgChangeRate,
    children: [
      ...group.children.map(child => toHierarchyDatum(child, marketCapRatio)),
      ...group.items.map(item => ({
        name: item.stockName,
        value: boxValue(item.totalMarketValue, marketCapRatio),
        totalMarketValue: item.totalMarketValue,
        item,
      })),
    ],
  }
}

export function useMarketMapLayout(
  groups: DisplayGroup[],
  selfSectorName: string | null,
  width: number,
  height: number,
  marketCapRatio: number,
): LaidOutSector[] {
  return useMemo(() => {
    if (width <= 0 || height <= 0 || groups.length === 0) return []

    const data: HierarchyDatum = {
      name: 'root',
      children: groups.map(group => toHierarchyDatum(group, marketCapRatio)),
    }

    const hierarchyRoot = hierarchy(data)
      .sum(d => d.value ?? 0)
      .sort((a, b) => (b.data.totalMarketValue ?? 0) - (a.data.totalMarketValue ?? 0))

    const totalValue = hierarchyRoot.value ?? 0
    if (totalValue <= 0) return []

    const root: HierarchyRectangularNode<HierarchyDatum> = treemap<HierarchyDatum>()
      .size([width, height])
      .paddingOuter(PADDING)
      // 자식이 전부 종목(하위 섹터 없음)인 노드만 더 좁은 간격을 쓴다 — 섹터와 종목이 섞여
      // 있으면 섹터 헤더 쪽 여유가 더 필요하니 섹터 기준 간격을 그대로 쓴다.
      .paddingInner(node =>
        (node.children ?? []).every(child => child.data.item) ? ITEM_SIBLING_GAP : SECTOR_SIBLING_GAP,
      )
      // d3 계층에서 node.depth===0은 화면에 안 보이는 합성 root라, 화면 기준 depth로 맞추려면 -1.
      // selfSectorName(드릴다운으로 들어온 자기 자신)은 헤더를 안 그리므로(MarketMapSectorSection
      // 참고 — breadcrumb과 중복이라 뺐다) 그 몫의 공간도 안 비워두고, 그 아래 자손들은 전부 한 뎁스씩
      // 앞당겨서(자기 자신이 아예 없는 것처럼) 헤더 높이를 매긴다 — selfSectorName이 있으면 항상
      // 이 트리 전체가 그 자기 자신 하나 밑에 있으므로(드릴다운 중엔 groups가 항상 원소 1개) 전역적으로
      // 한 번만 보정하면 된다.
      .paddingTop(node => {
        if (node.depth === 0 || node.data.item) return 0
        if (node.data.name === selfSectorName) return 0
        const renderDepth = node.depth - 1 - (selfSectorName !== null ? 1 : 0)
        return sectorHeaderHeight(renderDepth)
      })
      .round(true)(hierarchyRoot)

    const toLaidOutSector = (
      node: HierarchyRectangularNode<HierarchyDatum>,
      originX: number,
      originY: number,
    ): LaidOutSector => {
      const nx0 = node.x0 ?? 0
      const ny0 = node.y0 ?? 0
      const boxes: LaidOutStockBox[] = []
      const subSectors: LaidOutSector[] = []

      for (const child of node.children ?? []) {
        if (child.data.item) {
          const boxWidth = (child.x1 ?? 0) - (child.x0 ?? 0)
          const boxHeight = (child.y1 ?? 0) - (child.y0 ?? 0)
          boxes.push({
            item: child.data.item,
            x: (child.x0 ?? 0) - nx0,
            y: (child.y0 ?? 0) - ny0,
            width: boxWidth,
            height: boxHeight,
            areaPercent: ((boxWidth * boxHeight) / (width * height)) * 100,
          })
        } else {
          subSectors.push(toLaidOutSector(child, nx0, ny0))
        }
      }

      return {
        sectorId: node.data.sectorId ?? -1,
        sectorName: node.data.name,
        totalMarketValue: node.data.totalMarketValue ?? 0,
        weightedAvgChangeRate: node.data.weightedAvgChangeRate ?? null,
        simpleAvgChangeRate: node.data.simpleAvgChangeRate ?? null,
        isSelf: node.data.name === selfSectorName,
        x: nx0 - originX,
        y: ny0 - originY,
        width: (node.x1 ?? 0) - nx0,
        height: (node.y1 ?? 0) - ny0,
        boxes,
        subSectors,
      }
    }

    return (root.children ?? []).map(sectorNode => toLaidOutSector(sectorNode, 0, 0))
  }, [groups, selfSectorName, width, height, marketCapRatio])
}
