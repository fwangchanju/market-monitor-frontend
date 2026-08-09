import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useDroppable } from '@dnd-kit/core'
import MarketMapBox from './MarketMapBox'
import type { LaidOutCategory } from '@/hooks/useMarketMapLayout'
import { toJoEokDecimal } from '@/utils/format'

interface Props {
  category: LaidOutCategory
  onSelectCategory: (categoryName: string) => void
}

export default function MarketMapCategorySection({ category, onSelectCategory }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: category.categoryName })
  const [hover, setHover] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null)

  const label = `${category.categoryName}(시총:${toJoEokDecimal(category.totalMarketValue / 100_000_000)})`

  const updateTooltipPos = (e: React.MouseEvent) => {
    setTooltipPos({ left: e.clientX + (category.tooltipAlignLeft ? -12 : 12), top: e.clientY - 8 })
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
      className={`border ${isOver ? 'border-2 border-yellow-400 brightness-125' : 'border-white'}`}
    >
      <button
        type="button"
        onClick={category.isSelf ? undefined : () => onSelectCategory(category.categoryName)}
        onMouseEnter={handleMouseEnter}
        onMouseMove={updateTooltipPos}
        onMouseLeave={() => setHover(false)}
        className="absolute left-0 top-0 h-7 w-full truncate border-2 border-transparent bg-black/70 px-1 text-left text-sm font-bold text-white hover:border-yellow-400 hover:brightness-125"
      >
        {label}
      </button>
      {hover &&
        tooltipPos &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] w-max whitespace-nowrap rounded border border-gray-600 bg-[var(--surface)] px-2 py-1 text-left text-xs text-white shadow-lg"
            style={{ left: tooltipPos.left, top: tooltipPos.top, transform: category.tooltipAlignLeft ? 'translateX(-100%)' : undefined }}
          >
            {label}
          </div>,
          document.body,
        )}
      {category.subCategories.map(sub => (
        <MarketMapCategorySection key={sub.categoryName} category={sub} onSelectCategory={onSelectCategory} />
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
        />
      ))}
    </div>
  )
}
