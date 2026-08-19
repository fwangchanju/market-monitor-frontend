import { useEffect, useRef, useState } from 'react'
import { useMarketMapLayout, type DisplayGroup } from '@/hooks/useMarketMapLayout'
import MarketMapCategorySection from './MarketMapCategorySection'

interface Props {
  groups: DisplayGroup[]
  selfCategoryName: string | null
  onSelectCategory: (categoryName: string) => void
  heightClassName?: string
}

export default function MarketMapTreemap({
  groups,
  selfCategoryName,
  onSelectCategory,
  heightClassName = 'h-[70vh]',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      // contentRect가 소수점 단위라, 브라우저 줌/DPI 조합에 따라 실제로는 안 바뀐 크기를 매 프레임
      // 미세하게 다르게(예: 1234.4 → 1234.6) 보고하는 경우가 있다. 정수로 반올림해서 비교하고,
      // 값이 그대로면 리렌더(트리맵 재계산)를 아예 건너뛰어 이 흔들림이 무한 재계산으로 이어지지 않게 막는다.
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const categories = useMarketMapLayout(groups, selfCategoryName, size.width, size.height)

  return (
    // d3 반올림 오차로 우측 하단 박스가 컨테이너를 아주 살짝 넘칠 수 있는데, overflow가 열려있으면 그게
    // 페이지 스크롤바를 만들고, 스크롤바가 생기면 컨테이너 너비가 줄어서 ResizeObserver가 다시 계산 →
    // 이번엔 안 넘쳐서 스크롤바가 사라지고 너비가 늘고 → 다시 계산... 무한 루프(우측 하단이 떨리는 현상)로
    // 이어진다. overflow-hidden으로 이 삐져나옴 자체를 화면에서 잘라내 루프의 시작을 막는다.
    <div ref={containerRef} className={`relative w-full overflow-hidden ${heightClassName}`}>
      {categories.map(category => (
        <MarketMapCategorySection key={category.categoryName} category={category} onSelectCategory={onSelectCategory} />
      ))}
    </div>
  )
}
