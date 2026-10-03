import { useEffect, useState } from 'react'

interface Props {
  className?: string
  // true면 돌아가는 원 아래에 경과 시간(초)을 보여준다 — 오래 걸려도 "진행 중"임을 알 수 있게 한다. 1초가 지난 뒤부터 보인다.
  showElapsed?: boolean
}

export default function Spinner({ className = 'h-8 w-8', showElapsed = false }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!showElapsed) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [showElapsed])

  const circle = <div className={`animate-spin rounded-full border-2 border-gray-600 border-t-[var(--accent)] ${className}`} />
  if (!showElapsed) return circle

  return (
    <div role="status" className="flex flex-col items-center gap-2">
      {circle}
      <span className="h-4 text-xs tabular-nums text-gray-400">{elapsedSeconds >= 1 ? `${elapsedSeconds}초` : ''}</span>
    </div>
  )
}
