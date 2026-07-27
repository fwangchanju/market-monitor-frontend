import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import MarketMapBox from './MarketMapBox'
import type { LaidOutCategory } from '@/hooks/useMarketMapLayout'

interface Props {
  category: LaidOutCategory
  onSelectCategory: (categoryName: string) => void
}

export default function MarketMapCategorySection({ category, onSelectCategory }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: category.categoryName })
  const [headerHover, setHeaderHover] = useState(false)

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
      className={`border ${isOver ? 'border-2 border-white brightness-125' : 'border-gray-700'}`}
    >
      <button
        type="button"
        onClick={() => onSelectCategory(category.categoryName)}
        onMouseEnter={() => setHeaderHover(true)}
        onMouseLeave={() => setHeaderHover(false)}
        className={`absolute left-0 top-0 h-7 w-full truncate bg-black/70 px-1 text-left text-sm font-bold text-white ${
          headerHover ? 'border-2 border-white brightness-125' : 'border-2 border-transparent'
        }`}
      >
        {category.categoryName}
      </button>
      {category.boxes.map(box => (
        <MarketMapBox
          key={box.item.stockCode}
          item={box.item}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          categoryName={category.categoryName}
        />
      ))}
    </div>
  )
}
