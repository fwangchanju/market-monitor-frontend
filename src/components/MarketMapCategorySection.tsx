import { useState } from 'react'
import { createPortal } from 'react-dom'
import MarketMapBox from './MarketMapBox'
import { categoryHeaderHeight, PADDING, type LaidOutCategory } from '@/hooks/useMarketMapLayout'
import { toJoEokDecimal, toPctSigned } from '@/utils/format'
import type { MarketMapItem } from '@/types/api'

interface Props {
  category: LaidOutCategory
  onSelectCategory: (categoryName: string) => void
  onOpenExcludeMenu: (categoryId: number, categoryName: string, e: React.MouseEvent) => void
  showMarketValue: boolean
  showAvgChangeRate: boolean
  showUpDownCount: boolean
  // 커스텀 모드가 아닐 때는(기본 분류 트리) 카테고리 제외 액션 자체를 제공하지 않는다.
  canExclude: boolean
  depth?: number
}

// 이 카테고리 태그에 등락률 평균/상승·하락·보합을 보여주려면, 하위 카테고리까지 포함한
// 모든 종목이 필요하다(category.boxes는 이 뎁스 바로 아래 종목만 담고 있음).
function collectCategoryItems(category: LaidOutCategory): MarketMapItem[] {
  const items = category.boxes.map(box => box.item)
  for (const sub of category.subCategories) items.push(...collectCategoryItems(sub))
  return items
}

// 헤더 높이(categoryHeaderHeight)와 같은 비율로 폰트 크기도 depth에 따라 줄인다.
function categoryHeaderFontSize(depth: number): number {
  return Math.max(14 - depth * 2, 9)
}

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
  showMarketValue,
  showAvgChangeRate,
  showUpDownCount,
  canExclude,
  depth = 0,
}: Props) {
  const [hover, setHover] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null)

  // 옵션 꺼두면 박스 위 태그 텍스트에선 시총을 빼되, hover 툴팁은 상세 정보라 그대로 둔다.
  const marketValueSuffix = ` (시총: ${toJoEokDecimal(category.totalMarketValue / 100_000_000)})`
  const items = collectCategoryItems(category)
  const avgChangeRate = items.length > 0 ? items.reduce((sum, item) => sum + item.changeRate, 0) / items.length : 0
  const advancerCount = items.filter(item => item.changeRate > 0).length
  const declinerCount = items.filter(item => item.changeRate < 0).length
  const unchangedCount = items.length - advancerCount - declinerCount
  const avgChangeRateSuffix = ` (등락률 평균: ${toPctSigned(avgChangeRate)})`
  const upDownCountSuffix = ` (상승: ${advancerCount} / 하락: ${declinerCount} / 보합: ${unchangedCount})`
  const label = `${category.categoryName}${marketValueSuffix}${avgChangeRateSuffix}${upDownCountSuffix}`
  const headerLabel = `${category.categoryName}${showMarketValue ? marketValueSuffix : ''}${
    showAvgChangeRate ? avgChangeRateSuffix : ''
  }${showUpDownCount ? upDownCountSuffix : ''}`

  const updateTooltipPos = (e: React.MouseEvent) => {
    setTooltipPos({
      left: e.clientX + (category.tooltipAlignLeft ? -12 : 12),
      top: e.clientY + (category.tooltipAlignTop ? -8 : 8),
    })
  }

  const handleMouseEnter = (e: React.MouseEvent) => {
    setHover(true)
    updateTooltipPos(e)
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: category.x,
        top: category.y,
        width: category.width,
        height: category.height,
      }}
      className={`box-content border-2 ${hover ? 'border-yellow-600' : 'border-black'}`}
    >
      <button
        type="button"
        onClick={
          category.isSelf
            ? undefined
            : e => {
                onSelectCategory(category.categoryName)
                // 클릭 후에도 이 버튼에 포커스가 남아서 브라우저 기본 포커스 링이 계속 보이는 걸 방지.
                e.currentTarget.blur()
              }
        }
        onContextMenu={
          category.isSelf || !canExclude
            ? undefined
            : e => {
                e.preventDefault()
                onOpenExcludeMenu(category.categoryId, category.categoryName, e)
              }
        }
        onMouseEnter={handleMouseEnter}
        onMouseMove={updateTooltipPos}
        onMouseLeave={() => setHover(false)}
        style={{
          height: categoryHeaderHeight(depth),
          fontSize: categoryHeaderFontSize(depth),
          left: PADDING,
          width: `calc(100% - ${PADDING * 2}px)`,
        }}
        className={`absolute top-0 truncate border-2 border-transparent px-1 text-left font-bold text-white ${categoryHeaderColorClass(depth)}`}
      >
        {headerLabel}
      </button>
      {hover &&
        tooltipPos &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] w-max whitespace-nowrap rounded border border-gray-600 bg-[var(--surface)] px-2 py-1 text-left text-xs text-white shadow-lg"
            style={{
              left: tooltipPos.left,
              top: tooltipPos.top,
              transform: `translate(${category.tooltipAlignLeft ? '-100%' : '0'}, ${category.tooltipAlignTop ? '-100%' : '0'})`,
            }}
          >
            {label}
          </div>,
          document.body,
        )}
      {category.subCategories.map(sub => (
        <MarketMapCategorySection
          key={sub.categoryName}
          category={sub}
          onSelectCategory={onSelectCategory}
          onOpenExcludeMenu={onOpenExcludeMenu}
          showMarketValue={showMarketValue}
          showAvgChangeRate={showAvgChangeRate}
          showUpDownCount={showUpDownCount}
          canExclude={canExclude}
          depth={depth + 1}
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
          tooltipAlignLeft={box.tooltipAlignLeft}
          tooltipAlignTop={box.tooltipAlignTop}
        />
      ))}
    </div>
  )
}
