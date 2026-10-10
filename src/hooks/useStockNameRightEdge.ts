import { useLayoutEffect, useState, type RefObject } from 'react'

// 종목 표 위 검색창의 너비를 아래 "종목명" 열의 오른쪽 줄에 맞추기 위한 값 — 종목명 머리글 칸의 오른쪽 끝이 표 영역 왼쪽에서 몇 px인지.
// 열 폭은 창 너비에 따라 달라지므로 크기가 바뀔 때마다 다시 잰다. 아직 못 쟀으면 undefined(검색창 기본 너비를 쓴다).
export function useStockNameRightEdge(rootRef: RefObject<HTMLElement | null>, scrollRef: RefObject<HTMLElement | null>): number | undefined {
  const [rightEdge, setRightEdge] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    const root = rootRef.current
    const scroller = scrollRef.current
    if (!root || !scroller) return
    const measure = () => {
      const th = scroller.querySelector<HTMLElement>('th[data-column-key="stockName"]')
      if (!th) return
      setRightEdge(Math.round(th.getBoundingClientRect().right - root.getBoundingClientRect().left))
    }
    measure()
    scroller.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    observer.observe(scroller)
    window.addEventListener('resize', measure)
    return () => {
      scroller.removeEventListener('scroll', measure)
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [rootRef, scrollRef])
  return rightEdge
}
