import { useEffect, useRef, useState } from 'react'

// 받은 숫자(target)가 바뀌면 지금 보이는 값에서 새 값까지 durationMs 동안 올라가거나 내려가며 보여주는 훅. 처음 값과 null은 바로 보여준다.
// 움직이는 동안 target이 또 바뀌면 지금 보이는 값에서 새 목표로 이어서 움직인다. 끝에서 느려지는(ease-out) 곡선이다.
export function useNumberTween(target: number | null, durationMs: number): number | null {
  // 움직이는 중에 보여줄 숫자. null이면 받은 숫자를 그대로 보여준다.
  const [tweenValue, setTweenValue] = useState<number | null>(null)
  const previous = useRef<number | null>(target)
  const shownValue = useRef<number | null>(null)
  const frame = useRef<number | undefined>(undefined)

  useEffect(() => {
    const before = previous.current
    previous.current = target
    if (before === target) return
    if (frame.current !== undefined) {
      window.cancelAnimationFrame(frame.current)
      frame.current = undefined
    }
    const from = shownValue.current ?? before
    shownValue.current = null
    if (from === null || target === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 움직이는 중에 값이 바로 바뀌어야 하는 경우라 렌더 중에 계산할 수 없다
      setTweenValue(null)
      return
    }
    const startedAt = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs)
      if (progress >= 1) {
        frame.current = undefined
        shownValue.current = null
        setTweenValue(null)
        return
      }
      const eased = 1 - (1 - progress) ** 3
      shownValue.current = from + (target - from) * eased
      setTweenValue(Math.round(shownValue.current))
      frame.current = window.requestAnimationFrame(step)
    }
    frame.current = window.requestAnimationFrame(step)
  }, [target, durationMs])

  useEffect(() => () => {
    if (frame.current !== undefined) window.cancelAnimationFrame(frame.current)
  }, [])
  return tweenValue ?? target
}
