import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useDroppable } from '@dnd-kit/core'
import MarketMapBox from './MarketMapBox'
import type { LaidOutCategory } from '@/hooks/useMarketMapLayout'
import { toJoEokDecimal } from '@/utils/format'

interface Props {
  category: LaidOutCategory
  onSelectCategory: (categoryName: string) => void
  depth?: number
}

export default function MarketMapCategorySection({ category, onSelectCategory, depth = 0 }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: category.categoryName })
  const [hover, setHover] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null)

  const label = `${category.categoryName} (시총: ${toJoEokDecimal(category.totalMarketValue / 100_000_000)})`

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
      ref={setNodeRef}
      style={{
        position: 'absolute',
        left: category.x,
        top: category.y,
        width: category.width,
        height: category.height,
      }}
      className={`box-content border-2 ${isOver || hover ? 'border-yellow-600' : 'border-white'}`}
    >
      <button
        type="button"
        onClick={category.isSelf ? undefined : () => onSelectCategory(category.categoryName)}
        onMouseEnter={handleMouseEnter}
        onMouseMove={updateTooltipPos}
        onMouseLeave={() => setHover(false)}
        className={`absolute left-0 top-0 h-7 w-full truncate border-2 border-transparent px-1 text-left text-sm font-bold text-white ${
          depth === 0 ? 'bg-black/70' : 'bg-gray-500'
        }`}
      >
        {label}
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
        <MarketMapCategorySection key={sub.categoryName} category={sub} onSelectCategory={onSelectCategory} depth={depth + 1} />
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
