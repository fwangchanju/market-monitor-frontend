import { useEffect, useState } from 'react'
import marketryLogo from '@/assets/marketry-logo.png'

interface Props {
  className?: string
  // true면 아주 큰 원 안에 로고와 경과 시간(초)을, 아래에 안내 문구를 보여준다 — 오래 걸려도 "진행 중"임을 알 수 있게 한다.
  // 시간은 1초가 지난 뒤부터 보인다.
  showElapsed?: boolean
}

export default function Spinner({ className, showElapsed = false }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!showElapsed) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [showElapsed])

  if (!showElapsed) {
    return <div className={`animate-spin rounded-full border-2 border-gray-600 border-t-[var(--accent)] ${className ?? 'h-8 w-8'}`} />
  }

  // 시간을 보여주는 로딩은 화면 한가운데에서 오래 보게 되므로 원을 아주 크게(작은 화면에서는 화면 짧은 변의 60%까지) 그린다.
  // 숫자와 로고가 같이 돌지 않도록 도는 테두리와 안쪽 내용을 따로 겹쳐 놓는다.
  return (
    <div role="status" className="flex flex-col items-center gap-4">
      <div className={`relative ${className ?? 'h-[min(20rem,60vmin)] w-[min(20rem,60vmin)]'}`}>
        <div className="absolute inset-0 animate-spin rounded-full border-[6px] border-gray-600 border-t-[var(--accent)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <img src={marketryLogo} alt="" className="w-[72%] object-contain" />
          <span className="h-7 text-xl tabular-nums text-gray-300">{elapsedSeconds >= 1 ? `${elapsedSeconds}초` : ''}</span>
        </div>
      </div>
      <span className="text-base text-gray-300">데이터를 불러오는 중입니다.</span>
    </div>
  )
}
