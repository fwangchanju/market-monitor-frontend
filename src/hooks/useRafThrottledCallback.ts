import { useEffect, useRef } from 'react'

// mousemove(초당 60~120회)를 그대로 state에 반영하면 안 되는 상황(마켓맵 컬러 스케일 어드민의
// 라이트니스 슬라이더 드래그 등 — MarketMapBox/MarketMapCategorySection/MarketMapTreemap은
// memo가 없어서 draft config가 바뀔 때마다 맵 전체가 리렌더된다)을 위한 표준 rAF 쓰로틀.
// 매 이벤트마다 최신 값을 ref에 적어두고, 이미 예약된 frame이 없을 때만 새로 예약한다 —
// 한 프레임에 여러 번 호출돼도 실제 콜백은 프레임당 한 번, 그 프레임 시점의 "가장 최근 값"으로만 실행된다.
export function useRafThrottledCallback<T>(callback: (value: T) => void): (value: T) => void {
  const callbackRef = useRef(callback)
  // 렌더 중 ref를 직접 쓰지 않고(react-hooks/refs), 매 렌더 뒤 이펙트에서 "최신 콜백"으로만 갱신한다.
  useEffect(() => {
    callbackRef.current = callback
  })
  const rafIdRef = useRef<number | null>(null)
  const pendingValueRef = useRef<T | null>(null)

  return (value: T) => {
    pendingValueRef.current = value
    if (rafIdRef.current !== null) return
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      const pending = pendingValueRef.current
      pendingValueRef.current = null
      if (pending !== null) callbackRef.current(pending)
    })
  }
}
