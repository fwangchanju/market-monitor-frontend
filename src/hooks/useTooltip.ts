import { useState } from 'react'

interface TooltipPosition {
  left: number
  top: number
}

// 마우스를 따라다니는 툴팁의 hover 상태/좌표 계산을 공통화한 훅.
// offsetX/offsetY는 트리거(종목 박스, 카테고리 헤더 등)마다 다를 수 있어 호출부에서 각자 값을 넘긴다.
export function useTooltip(offsetX: number, offsetY: number, alignLeft: boolean, alignTop: boolean) {
  const [hover, setHover] = useState(false)
  const [position, setPosition] = useState<TooltipPosition | null>(null)

  const onMouseMove = (e: React.MouseEvent) => {
    setPosition({
      left: e.clientX + (alignLeft ? -offsetX : offsetX),
      top: e.clientY + (alignTop ? -offsetY : offsetY),
    })
  }

  const onMouseEnter = (e: React.MouseEvent) => {
    setHover(true)
    onMouseMove(e)
  }

  const onMouseLeave = () => setHover(false)

  return { hover, position, onMouseEnter, onMouseMove, onMouseLeave }
}
