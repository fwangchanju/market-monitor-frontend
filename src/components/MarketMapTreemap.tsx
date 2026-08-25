import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMarketMapLayout, type DisplayGroup, type LaidOutCategory } from '@/hooks/useMarketMapLayout'
import MarketMapCategorySection from './MarketMapCategorySection'

interface Props {
  groups: DisplayGroup[]
  selfCategoryName: string | null
  // depth는 지금 드릴다운 깊이(path.length) — 줌 방향(들어가는지/나가는지) 판단과, 뎁스별 진입 지점을
  // 기억해뒀다가 나갈 때 그대로 되감기 위한 키로 쓴다.
  depth: number
  onSelectCategory: (categoryName: string) => void
  onExcludeCategory: (categoryId: number, categoryName: string) => void
  heightClassName?: string
  // 셋 다 null = 전부 꺼짐. [min, max]면 그 뎁스 범위(현재 화면 기준 상대 뎁스)에서만 표시.
  marketValueDepthRange: [number, number] | null
  avgChangeRateDepthRange: [number, number] | null
  upDownCountDepthRange: [number, number] | null
  // 커스텀 모드가 아닐 때는(기본 분류 트리) 카테고리 제외 액션 자체를 제공하지 않는다.
  canExclude: boolean
  // 0이 아닌 뎁스가 오면 그 뎁스로 진입할 때 썼던 위치로 줄어드는 애니메이션을 재생한다.
  zoomOutRequestDepth: number | null
  onZoomOutComplete: (depth: number) => void
}

interface ContextMenuState {
  categoryId: number
  categoryName: string
  left: number
  top: number
}

// 컨테이너 기준 0~1 비율 좌표 — 컨테이너 크기가 나중에 달라져도(리사이즈) 값이 그대로 유효하다.
interface RelativeRect {
  left: number
  top: number
  width: number
  height: number
}

// 사라지는(줌인 땐 옛 화면, 줌아웃 땐 방금까지 보던 화면) 스냅샷을 실제 화면 위에 겹쳐 그렸다가
// 트랜지션 끝나면 치우는 "고스트" 레이어. direction에 따라 실제 콘텐츠보다 위/아래 어느 쪽에 그릴지가 다르다
// (줌인: 실제 콘텐츠가 고스트를 덮으며 커짐 / 줌아웃: 고스트가 실제 콘텐츠를 덮은 채 줄어들며 사라짐).
interface GhostOverlay {
  categories: LaidOutCategory[]
  direction: 'in' | 'out'
  style: React.CSSProperties
}

const ZOOM_IN_DURATION = 320
const ZOOM_OUT_DURATION = 280
const noop = () => {}

function toRelativeRect(rect: DOMRect, containerRect: DOMRect): RelativeRect {
  return {
    left: (rect.left - containerRect.left) / containerRect.width,
    top: (rect.top - containerRect.top) / containerRect.height,
    width: rect.width / containerRect.width,
    height: rect.height / containerRect.height,
  }
}

// 전체 크기(스케일 1)로 그려진 컨테이너가, 특정 작은 사각형(rect) 위치/크기인 것처럼 보이게 만드는 transform.
// transform-origin을 0 0으로 두고 translate 뒤에 scale을 적용하면(둘 다 컨테이너 픽셀 기준),
// 왼쪽위 모서리가 정확히 rect의 왼쪽위로, 나머지 모서리도 비율대로 rect 크기에 맞게 줄어든다.
function toShrinkTransform(rect: RelativeRect, containerRect: DOMRect): string {
  const left = rect.left * containerRect.width
  const top = rect.top * containerRect.height
  return `translate(${left}px, ${top}px) scale(${rect.width}, ${rect.height})`
}

export default function MarketMapTreemap({
  groups,
  selfCategoryName,
  depth,
  onSelectCategory,
  onExcludeCategory,
  heightClassName = 'h-[70vh]',
  marketValueDepthRange,
  avgChangeRateDepthRange,
  upDownCountDepthRange,
  canExclude,
  zoomOutRequestDepth,
  onZoomOutComplete,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  // 헤더가 뎁스에 따라 아주 작아질 수 있어서(최소 16px), hover로 버튼을 끼워 넣는 대신
  // 우클릭 컨텍스트 메뉴로 "이 섹터 제외"를 제공한다 — 박스 크기와 무관하게 항상 동작한다.
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  // 실제(현재) 콘텐츠 wrapper에 거는 transform/opacity — 줌인일 때만 쓴다(작게 시작해서 꽉 차게 커짐).
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties | undefined>(undefined)
  // 사라지는 옛 화면을 실제 콘텐츠 위/아래에 겹쳐 그리는 고스트 — 형제 카테고리들이 순간 사라지지 않고
  // 서서히 페이드아웃(줌인)/줄어들며 사라지도록(줌아웃) 보여준다.
  const [ghost, setGhost] = useState<GhostOverlay | null>(null)
  // 카테고리 진입(클릭) 시점에 캡처한 "그 박스가 화면에서 차지하던 위치" — 뎁스별로 기억해뒀다가
  // 다시 나갈 때 정확히 그 자리로 줄어드는 반대 애니메이션에 재사용한다.
  const entryRectsRef = useRef<Map<number, RelativeRect>>(new Map())
  // 클릭~실제 path 반영(재렌더) 사이에 잠깐 들고 있는 값들 — 클릭 시점엔 아직 depth/groups가 안 바뀌어
  // 있어서, 새 depth로 렌더된 뒤(useLayoutEffect)에야 확정해서 쓴다.
  const pendingEnterRectRef = useRef<RelativeRect | null>(null)
  const outgoingSnapshotRef = useRef<LaidOutCategory[] | null>(null)
  const prevDepthRef = useRef(depth)

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

  // 카테고리 클릭 시점의(=아직 이전 뎁스 화면인 상태의) 박스 위치와, 지금 화면 전체(형제 포함) 스냅샷을
  // 미리 잡아두고 실제 이동을 요청한다. 새 뎁스로 리렌더된 뒤 아래 useLayoutEffect가 이 값들을 읽어서
  // "그 자리에서 확대되면서, 형제들은 서서히 사라지는" 애니메이션을 만든다.
  const handleSelectCategory = (categoryName: string, rect: DOMRect) => {
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (containerRect && containerRect.width > 0 && containerRect.height > 0) {
      pendingEnterRectRef.current = toRelativeRect(rect, containerRect)
    }
    outgoingSnapshotRef.current = categories
    onSelectCategory(categoryName)
  }

  useLayoutEffect(() => {
    const containerRect = containerRef.current?.getBoundingClientRect()

    if (depth > prevDepthRef.current) {
      // 줌인: 이번 뎁스 진입에 쓰인 rect를 건너뛴 구간 전부에 저장해두고(나중에 되감기용 — "전체" 화면에서는
      // 세부 카테고리를 바로 클릭해서 여러 뎁스를 한 번에 건너뛸 수 있다), 방금 새로 그려진(꽉 찬 크기)
      // 실제 콘텐츠를 그 rect 자리/크기로 순간 이동시켰다가 다음 프레임에 원래 크기로 트랜지션한다 —
      // FLIP(First-Last-Invert-Play) 기법. 옛 화면 스냅샷은 고스트로 실제 콘텐츠 아래 깔아서, 실제
      // 콘텐츠가 커지며 덮어가는 동안 형제들이 서서히 페이드아웃하듯 보이게 한다.
      const pendingRect = pendingEnterRectRef.current
      const snapshot = outgoingSnapshotRef.current
      pendingEnterRectRef.current = null
      outgoingSnapshotRef.current = null
      if (pendingRect && containerRect) {
        for (let d = prevDepthRef.current; d < depth; d++) {
          entryRectsRef.current.set(d, pendingRect)
        }
        setGhost(snapshot ? { categories: snapshot, direction: 'in', style: { opacity: 1, transition: 'none' } } : null)
        setZoomStyle({
          transform: toShrinkTransform(pendingRect, containerRect),
          opacity: 1,
          transition: 'none',
        })
        requestAnimationFrame(() => {
          setGhost(prev => (prev ? { ...prev, style: { opacity: 0, transition: `opacity ${ZOOM_IN_DURATION}ms ease-out` } } : null))
          setZoomStyle({
            transform: 'none',
            opacity: 1,
            transition: `transform ${ZOOM_IN_DURATION}ms ease-out`,
          })
        })
        const timer = window.setTimeout(() => setGhost(null), ZOOM_IN_DURATION)
        prevDepthRef.current = depth
        return () => window.clearTimeout(timer)
      }
    } else if (depth < prevDepthRef.current) {
      // 줌아웃: onZoomOutComplete가 이미 실제 이동을 끝낸 뒤라(아래 useEffect에서 이동 전에 스냅샷만
      // 먼저 떠둠), 지금 categories는 이미 "더 얕은 뎁스"의 실제 콘텐츠(형제 포함)다. 방금까지 보던
      // 화면(스냅샷)을 고스트로 그 위에 통째로 덮어 씌운 채, 나갈 때 썼던 rect 자리로 줄이면서
      // 페이드아웃시켜 걷어내고, 배경(실제 콘텐츠)도 같은 시간 동안 페이드인시켜 둘이 하나의
      // 전환처럼 이어지게 한다(배경만 트랜지션 없이 툭 나타나면 고스트랑 따로 노는 것처럼 보였다).
      const rect = entryRectsRef.current.get(depth)
      const snapshot = outgoingSnapshotRef.current
      outgoingSnapshotRef.current = null
      if (rect && containerRect && snapshot) {
        setZoomStyle({ opacity: 0, transition: 'none' })
        setGhost({ categories: snapshot, direction: 'out', style: { transform: 'none', opacity: 1, transition: 'none' } })
        requestAnimationFrame(() => {
          setZoomStyle({ opacity: 1, transition: `opacity ${ZOOM_OUT_DURATION}ms ease-in` })
          setGhost(prev =>
            prev
              ? {
                  ...prev,
                  style: {
                    transform: toShrinkTransform(rect, containerRect),
                    opacity: 0,
                    transition: `transform ${ZOOM_OUT_DURATION}ms ease-in, opacity ${ZOOM_OUT_DURATION}ms ease-in`,
                  },
                }
              : null,
          )
        })
        const timer = window.setTimeout(() => setGhost(null), ZOOM_OUT_DURATION)
        prevDepthRef.current = depth
        return () => window.clearTimeout(timer)
      }
    }
    prevDepthRef.current = depth
  }, [depth, groups])

  // 줌아웃 트리거 — breadcrumb 클릭으로 부모가 zoomOutRequestDepth를 지정하면, 지금(=곧 사라질) 화면의
  // 스냅샷을 먼저 떠두고 바로 실제 이동을 요청한다. 실제 애니메이션은 위 useLayoutEffect가 depth가
  // 줄어든 걸 감지해서 재생한다(이동이 이미 끝난 뒤라 실제 콘텐츠가 밑에 다 그려져 있는 상태).
  useEffect(() => {
    if (zoomOutRequestDepth == null) return
    outgoingSnapshotRef.current = categories
    onZoomOutComplete(zoomOutRequestDepth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomOutRequestDepth])

  return (
    // d3 반올림 오차로 우측 하단 박스가 컨테이너를 아주 살짝 넘칠 수 있는데, overflow가 열려있으면 그게
    // 페이지 스크롤바를 만들고, 스크롤바가 생기면 컨테이너 너비가 줄어서 ResizeObserver가 다시 계산 →
    // 이번엔 안 넘쳐서 스크롤바가 사라지고 너비가 늘고 → 다시 계산... 무한 루프(우측 하단이 떨리는 현상)로
    // 이어진다. overflow-hidden으로 이 삐져나옴 자체를 화면에서 잘라내 루프의 시작을 막는다.
    <div ref={containerRef} className={`relative w-full overflow-hidden bg-black ${heightClassName}`}>
      {/* 줌인일 땐 고스트(옛 화면)를 실제 콘텐츠보다 아래(zIndex -1)에 깔아서, 커지는 실제 콘텐츠가
          덮어가며 형제들을 가리게 하고, 줌아웃일 땐 반대로 위(zIndex 10)에 덮어서 줄어들며 걷히게 한다.
          transform-origin은 항상 '0 0'으로 고정 — zoomStyle 쪽 객체에 넣으면 identity로 바뀔 때 origin
          값이 통째로 빠지면서 브라우저가 origin까지 같이 보간해버려(중앙으로 드리프트), 줌이 클릭 지점이
          아니라 화면 중앙에서 일어나는 것처럼 보이는 버그가 있었다. */}
      {ghost && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ transformOrigin: '0 0', zIndex: ghost.direction === 'out' ? 10 : -1, ...ghost.style }}
        >
          {ghost.categories.map(category => (
            <MarketMapCategorySection
              key={category.categoryName}
              category={category}
              onSelectCategory={noop}
              onOpenExcludeMenu={noop}
              marketValueDepthRange={marketValueDepthRange}
              avgChangeRateDepthRange={avgChangeRateDepthRange}
              upDownCountDepthRange={upDownCountDepthRange}
              canExclude={false}
            />
          ))}
        </div>
      )}
      <div className="absolute inset-0" style={{ transformOrigin: '0 0', ...zoomStyle }}>
        {categories.map(category => (
          <MarketMapCategorySection
            key={category.categoryName}
            category={category}
            onSelectCategory={handleSelectCategory}
            onOpenExcludeMenu={handleOpenExcludeMenu}
            marketValueDepthRange={marketValueDepthRange}
            avgChangeRateDepthRange={avgChangeRateDepthRange}
            upDownCountDepthRange={upDownCountDepthRange}
            canExclude={canExclude}
          />
        ))}
      </div>
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
