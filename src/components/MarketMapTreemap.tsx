import { useEffect, useRef, useState } from 'react'
import type { MarketMapCategoryGroup } from '@/types/api'
import { useMarketMapLayout } from '@/hooks/useMarketMapLayout'
import MarketMapCategorySection from './MarketMapCategorySection'

interface Props {
  groups: MarketMapCategoryGroup[]
  onSelectCategory: (categoryName: string) => void
  heightClassName?: string
}

export default function MarketMapTreemap({ groups, onSelectCategory, heightClassName = 'h-[70vh]' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

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
    <div ref={containerRef} className={`relative w-full ${heightClassName}`}>
      {categories.map(category => (
        <MarketMapCategorySection key={category.categoryName} category={category} onSelectCategory={onSelectCategory} />
      ))}
    </div>
  )
}
