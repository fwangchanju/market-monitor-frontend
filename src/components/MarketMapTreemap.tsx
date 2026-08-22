import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMarketMapLayout, type DisplayGroup } from '@/hooks/useMarketMapLayout'
import MarketMapCategorySection from './MarketMapCategorySection'

interface Props {
  groups: DisplayGroup[]
  selfCategoryName: string | null
  onSelectCategory: (categoryName: string) => void
  onExcludeCategory: (categoryId: number, categoryName: string) => void
  heightClassName?: string
  showMarketValue: boolean
  // 커스텀 모드가 아닐 때는(기본 분류 트리) 카테고리 제외 액션 자체를 제공하지 않는다.
  canExclude: boolean
}

interface ContextMenuState {
  categoryId: number
  categoryName: string
  left: number
  top: number
}

export default function MarketMapTreemap({
  groups,
  selfCategoryName,
  onSelectCategory,
  onExcludeCategory,
  heightClassName = 'h-[70vh]',
  showMarketValue,
  canExclude,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  // 헤더가 뎁스에 따라 아주 작아질 수 있어서(최소 16px), hover로 버튼을 끼워 넣는 대신
  // 우클릭 컨텍스트 메뉴로 "이 섹터 제외"를 제공한다 — 박스 크기와 무관하게 항상 동작한다.
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

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

  const handleOpenExcludeMenu = (categoryId: number, categoryName: string, e: React.MouseEvent) => {
    setContextMenu({ categoryId, categoryName, left: e.clientX, top: e.clientY })
  }

  useEffect(() => {
    if (!contextMenu) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [contextMenu])

  return (
    // d3 반올림 오차로 우측 하단 박스가 컨테이너를 아주 살짝 넘칠 수 있는데, overflow가 열려있으면 그게
    // 페이지 스크롤바를 만들고, 스크롤바가 생기면 컨테이너 너비가 줄어서 ResizeObserver가 다시 계산 →
    // 이번엔 안 넘쳐서 스크롤바가 사라지고 너비가 늘고 → 다시 계산... 무한 루프(우측 하단이 떨리는 현상)로
    // 이어진다. overflow-hidden으로 이 삐져나옴 자체를 화면에서 잘라내 루프의 시작을 막는다.
    <div ref={containerRef} className={`relative w-full overflow-hidden ${heightClassName}`}>
      {categories.map(category => (
        <MarketMapCategorySection
          key={category.categoryName}
          category={category}
          onSelectCategory={onSelectCategory}
          onOpenExcludeMenu={handleOpenExcludeMenu}
          showMarketValue={showMarketValue}
          canExclude={canExclude}
        />
      ))}
      {contextMenu &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={e => e.preventDefault()} />
            <div
              className="fixed z-50 w-max border border-gray-700 bg-[var(--surface)] py-1 text-xs shadow-lg"
              style={{ left: contextMenu.left, top: contextMenu.top }}
            >
              <button
                type="button"
                onClick={() => {
                  onExcludeCategory(contextMenu.categoryId, contextMenu.categoryName)
                  setContextMenu(null)
                }}
                className="block w-full whitespace-nowrap border-0 bg-transparent px-3 py-1.5 text-left text-red-500 hover:bg-red-500/10"
              >
                {contextMenu.categoryName} 제외
              </button>
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}
