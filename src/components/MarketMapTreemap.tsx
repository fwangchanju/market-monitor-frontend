import { useEffect, useRef, useState } from 'react'
import { DndContext } from '@dnd-kit/core'
import type { MarketMapCategoryGroup } from '@/types/api'
import { useMarketMapLayout } from '@/hooks/useMarketMapLayout'
import { useMarketMapDragEnd } from '@/hooks/useMarketMapDragEnd'
import MarketMapCategorySection from './MarketMapCategorySection'

interface Props {
  groups: MarketMapCategoryGroup[]
  onSelectCategory: (categoryName: string) => void
}

export default function MarketMapTreemap({ groups, onSelectCategory }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const handleDragEnd = useMarketMapDragEnd()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const categories = useMarketMapLayout(groups, size.width, size.height)

  return (
    <div ref={containerRef} className="relative h-[70vh] w-full">
      <DndContext onDragEnd={handleDragEnd}>
        {categories.map(category => (
          <MarketMapCategorySection
            key={category.categoryName}
            category={category}
            onSelectCategory={onSelectCategory}
          />
        ))}
      </DndContext>
    </div>
  )
}
