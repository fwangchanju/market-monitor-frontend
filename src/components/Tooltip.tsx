import { createPortal } from 'react-dom'

interface Props {
  visible: boolean
  position: { left: number; top: number } | null
  alignLeft: boolean
  alignTop: boolean
  children: React.ReactNode
}

// 마우스를 따라다니며 뜨는 공통 툴팁 — 종목 박스/카테고리 태그가 동일한 스타일로 사용한다.
// 위치 계산(useTooltip)과 내용(children)은 호출부 책임, 이 컴포넌트는 렌더링만 담당한다.
export default function Tooltip({ visible, position, alignLeft, alignTop, children }: Props) {
  if (!visible || !position) return null

  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] w-max whitespace-nowrap rounded border border-gray-600 bg-[var(--surface)] px-2 py-1 text-left text-base text-white shadow-lg"
      style={{
        left: position.left,
        top: position.top,
        transform: `translate(${alignLeft ? '-100%' : '0'}, ${alignTop ? '-100%' : '0'})`,
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
