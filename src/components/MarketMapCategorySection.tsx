import { useRef } from 'react'
import MarketMapBox from './MarketMapBox'
import Tooltip from './Tooltip'
import { useTooltip } from '@/hooks/useTooltip'
import { categoryHeaderFontSize, categoryHeaderHeight, PADDING, type LaidOutCategory } from '@/hooks/useMarketMapLayout'
import { TAB_GAP, avgChangeRateLabel, toJoEokDecimal, toPctSigned } from '@/utils/format'
import type { MarketMapItem } from '@/types/api'
import type { ColorScaleConfig } from '@/utils/marketMapColorScale'
import type { StockLabelMode } from '@/hooks/useGlobalSettings'

interface Props {
  category: LaidOutCategory
  // rect는 이 카테고리 박스 전체의 화면상 위치 — 줌인 애니메이션이 어디서부터 확대되는지 계산하는 데 쓴다.
  onSelectCategory: (categoryName: string, rect: DOMRect) => void
  onOpenExcludeMenu: (categoryId: number, categoryName: string, e: React.MouseEvent) => void
  // 셋 다 null = 전부 꺼짐. [min, max]면 그 뎁스 범위(현재 화면 기준 상대 뎁스)에서만 표시.
  marketValueDepthRange: [number, number] | null
  avgChangeRateDepthRange: [number, number] | null
  upDownCountDepthRange: [number, number] | null
  // true면 가중평균 대신 산술평균을 표시(태그/툴팁).
  avgChangeRateUseSimple: boolean
  // 커스텀 모드가 아닐 때는(기본 분류 트리) 카테고리 제외 액션 자체를 제공하지 않는다.
  canExclude: boolean
  // 하위 MarketMapBox까지 그대로 관통해서 전달 — 박스 색칠 설정의 단일 출처.
  colorScale: ColorScaleConfig
  // 하위 MarketMapBox까지 그대로 관통해서 전달 — 종목명/등락률 표시 여부를 가르는 넓이 비중(%) 기준.
  labelMinAreaPercent: number
  // 하위 MarketMapBox까지 그대로 관통해서 전달 — 종목명만/등락률만/둘 다 보여줄지.
  stockLabelMode: StockLabelMode
  depth?: number
}

// 이 카테고리 태그에 등락률 평균/상승·하락·보합을 보여주려면, 하위 카테고리까지 포함한
// 모든 종목이 필요하다(category.boxes는 이 뎁스 바로 아래 종목만 담고 있음).
function collectCategoryItems(category: LaidOutCategory): MarketMapItem[] {
  const items = category.boxes.map(box => box.item)
  for (const sub of category.subCategories) items.push(...collectCategoryItems(sub))
  return items
}

function isInDepthRange(range: [number, number] | null, depth: number): boolean {
  return range !== null && depth >= range[0] && depth <= range[1]
}

function localWeightedAvgChangeRate(items: MarketMapItem[]): number {
  const totalWeight = items.reduce((sum, item) => sum + item.totalMarketValue, 0)
  return totalWeight > 0 ? items.reduce((sum, item) => sum + item.changeRate * item.totalMarketValue, 0) / totalWeight : 0
}

function localSimpleAvgChangeRate(items: MarketMapItem[]): number {
  return items.length > 0 ? items.reduce((sum, item) => sum + item.changeRate, 0) / items.length : 0
}

// 마우스 커서(손모양 아이콘)가 툴팁 첫 글자를 가리지 않도록 두는 좌우 간격 — 종목 박스 툴팁과
// 동일한 간격(56px)을 쓰지만, 이 컴포넌트 전용 값으로 별도 관리한다(MarketMapBox.tsx에서 import하지 않음).
const TOOLTIP_OFFSET_X = 56

// 투명도로 옅게 하면 페이지 배경 자체가 어두워서 뒤로 비치는 색이 없어 거의 구분이 안 됐다 —
// 배경과 무관하게 확실히 보이도록 불투명한 순수 무채색(파란기 없는 진짜 검정~회색)을 뎁스가
// 깊어질수록 점점 밝게 나열한다. Tailwind의 gray-600(파란기 도는 회색, 등락률 0%에 이미 씀)과
// 헷갈리지 않게 임의값 hex를 쓴다. 배열 끝에 도달하면 마지막 값을 반복한다(더 깊어져도 안전).
const CATEGORY_HEADER_COLORS = ['bg-black', 'bg-[#333333]', 'bg-[#4d4d4d]', 'bg-[#666666]']
function categoryHeaderColorClass(depth: number): string {
  return CATEGORY_HEADER_COLORS[Math.min(depth, CATEGORY_HEADER_COLORS.length - 1)]
}

export default function MarketMapCategorySection({
  category,
  onSelectCategory,
  onOpenExcludeMenu,
  marketValueDepthRange,
  avgChangeRateDepthRange,
  upDownCountDepthRange,
  avgChangeRateUseSimple,
  canExclude,
  colorScale,
  labelMinAreaPercent,
  stockLabelMode,
  depth = 0,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const tooltip = useTooltip(TOOLTIP_OFFSET_X, 8, category.tooltipAlignLeft, category.tooltipAlignTop)

  const items = collectCategoryItems(category)
  // 백엔드가 내려주는 값을 우선 쓰고, 아직 스냅샷이 없는 카테고리(기본 마켓맵, 신설 카테고리 등)만
  // 종목 목록으로 그 자리에서 계산해 보완한다.
  const avgChangeRate = avgChangeRateUseSimple
    ? (category.simpleAvgChangeRate ?? localSimpleAvgChangeRate(items))
    : (category.weightedAvgChangeRate ?? localWeightedAvgChangeRate(items))
  const advancerCount = items.filter(item => item.changeRate > 0).length
  const declinerCount = items.filter(item => item.changeRate < 0).length
  const unchangedCount = items.length - advancerCount - declinerCount
  // 태그는 공간이 좁아서 라벨 없이 값만 나열한다 — 표시되는 항목들 사이는 TAB_GAP으로 구분,
  // 등락 종목수 안의 상승/하락/보합 사이는 스페이스 1칸. 순서는 등락률 → 등락 종목수 → 시총(표시 설정 순서와 동일).
  const headerParts = [
    isInDepthRange(avgChangeRateDepthRange, depth) ? toPctSigned(avgChangeRate) : null,
    isInDepthRange(upDownCountDepthRange, depth)
      ? `${advancerCount}(↑) ${declinerCount}(↓) ${unchangedCount}(-)`
      : null,
    isInDepthRange(marketValueDepthRange, depth) ? toJoEokDecimal(category.totalMarketValue / 100_000_000) : null,
  ].filter((part): part is string => part !== null)
  const headerSuffix = headerParts.length > 0 ? `${TAB_GAP}${headerParts.join(TAB_GAP)}` : ''

  return (
    <div
      ref={boxRef}
      style={{
        position: 'absolute',
        left: category.x,
        top: category.y,
        width: category.width,
        height: category.height,
        // 나중에 그려지는 형제 카테고리의 테두리가 먼저 hover된 카테고리의 테두리 위를 덮지 않도록,
        // MarketMapBox와 동일하게 hover 시 z-index를 올린다.
        zIndex: tooltip.hover ? 20 : undefined,
      }}
      className={`box-content ${tooltip.hover ? 'border-2 border-yellow-600' : 'border border-black'}`}
    >
      {/* isSelf(드릴다운으로 들어온 자기 자신)는 헤더 태그를 안 그린다 — breadcrumb에 이미
          "KOSPI > 반도체"처럼 같은 이름이 떠 있어서 중복이기 때문(useMarketMapLayout의 paddingTop도
          이 카테고리 몫의 헤더 공간을 아예 안 비워둔다). 그 대신 실제 하위 카테고리들이 이 자리를 이어받아
          맨 위(depth 0) 취급을 받는다(아래 subCategories map의 depth 전달 참고). */}
      {!category.isSelf && (
        <>
          <button
            type="button"
            onClick={e => {
              const rect = boxRef.current?.getBoundingClientRect()
              onSelectCategory(category.categoryName, rect ?? e.currentTarget.getBoundingClientRect())
              // 클릭 후에도 이 버튼에 포커스가 남아서 브라우저 기본 포커스 링이 계속 보이는 걸 방지.
              e.currentTarget.blur()
            }}
            onContextMenu={
              !canExclude
                ? undefined
                : e => {
                    e.preventDefault()
                    onOpenExcludeMenu(category.categoryId, category.categoryName, e)
                  }
            }
            onMouseEnter={tooltip.onMouseEnter}
            onMouseMove={tooltip.onMouseMove}
            onMouseLeave={tooltip.onMouseLeave}
            style={{
              height: categoryHeaderHeight(depth),
              fontSize: categoryHeaderFontSize(depth),
              left: PADDING,
              width: `calc(100% - ${PADDING * 2}px)`,
            }}
            className={`absolute top-0 flex items-center overflow-hidden truncate border-2 border-transparent px-1 text-left font-bold leading-none ${depth === 0 ? 'text-yellow-600' : 'text-white'} ${categoryHeaderColorClass(depth)}`}
          >
            {category.categoryName}
            {headerSuffix && <span className="font-normal">{headerSuffix}</span>}
          </button>
          <Tooltip
            visible={tooltip.hover}
            position={tooltip.position}
            alignLeft={category.tooltipAlignLeft}
            alignTop={category.tooltipAlignTop}
          >
            <div className="font-bold">{category.categoryName}</div>
            <div> {avgChangeRateLabel(avgChangeRateUseSimple)}: {toPctSigned(avgChangeRate)}</div>
            <div> 상승 {advancerCount} 하락 {declinerCount} 보합 {unchangedCount}</div>
            <div> 시가총액 합: {toJoEokDecimal(category.totalMarketValue / 100_000_000)}</div>
          </Tooltip>
        </>
      )}
      {category.subCategories.map(sub => (
        <MarketMapCategorySection
          key={sub.categoryName}
          category={sub}
          onSelectCategory={onSelectCategory}
          onOpenExcludeMenu={onOpenExcludeMenu}
          marketValueDepthRange={marketValueDepthRange}
          avgChangeRateDepthRange={avgChangeRateDepthRange}
          upDownCountDepthRange={upDownCountDepthRange}
          avgChangeRateUseSimple={avgChangeRateUseSimple}
          canExclude={canExclude}
          colorScale={colorScale}
          labelMinAreaPercent={labelMinAreaPercent}
          stockLabelMode={stockLabelMode}
          depth={category.isSelf ? depth : depth + 1}
        />
      ))}
      {category.boxes.map(box => (
        <MarketMapBox
          key={box.item.stockCode}
          item={box.item}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          areaPercent={box.areaPercent}
          labelMinAreaPercent={labelMinAreaPercent}
          stockLabelMode={stockLabelMode}
          tooltipAlignLeft={box.tooltipAlignLeft}
          tooltipAlignTop={box.tooltipAlignTop}
          colorScale={colorScale}
        />
      ))}
    </div>
  )
}
