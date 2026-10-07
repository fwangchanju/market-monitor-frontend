import { useEffect, useState } from 'react'
import MarketryLogo from '@/components/MarketryLogo'

interface Props {
  className?: string
  // true면 아주 큰 원 안에 로고와 경과 시간(초)을, 아래에 안내 문구를 보여준다 — 오래 걸려도 "진행 중"임을 알 수 있게 한다.
  // 시간은 1초가 지난 뒤부터 보인다.
  showElapsed?: boolean
  // 설정창처럼 좁은 영역에서는 문구 없이 원과 로고만 표시한다.
  showLogo?: boolean
  // 데이터를 불러오지 못했을 때 — 로딩 화면과 같은 자리·크기로 로고 아래에 이 문구를 보여준다(원은 돌지 않고 시간도 없다).
  errorMessage?: string
}

export default function Spinner({ className, showElapsed = false, showLogo = false, errorMessage }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!showElapsed) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [showElapsed])

  if (errorMessage) {
    return (
      <div role="alert" className={`relative ${className ?? 'h-[min(20rem,60vmin)] w-[min(20rem,60vmin)]'}`}>
        <div className="absolute inset-0 rounded-full border-[6px] border-gray-600" />
        <div className="absolute inset-0 grid grid-rows-[1fr_auto_1fr] justify-items-center">
          <div />
          <MarketryLogo className="h-auto w-[72%]" />
          <div className="flex flex-col items-center gap-1 pt-4">
            <span className="text-base text-gray-300">{errorMessage}</span>
          </div>
        </div>
      </div>
    )
  }

  if (!showElapsed && !showLogo) {
    return <div className={`animate-spin rounded-full border-2 border-gray-600 border-t-[var(--accent)] ${className ?? 'h-8 w-8'}`} />
  }

  if (!showElapsed) {
    return (
      <div role="status" aria-label="설정 처리 중" className={`relative ${className ?? 'h-24 w-24'}`}>
        <div aria-hidden="true" className="absolute inset-0 animate-spin rounded-full border-[3px] border-gray-600 border-t-[var(--accent)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <MarketryLogo className="h-auto w-[72%]" />
        </div>
      </div>
    )
  }

  // 시간을 보여주는 로딩은 화면 한가운데에서 오래 보게 되므로 원을 아주 크게(작은 화면에서는 화면 짧은 변의 60%까지) 그린다.
  // 숫자와 로고가 같이 돌지 않도록 도는 테두리와 안쪽 내용을 따로 겹쳐 놓는다.
  // 안쪽은 [빈 칸 / 로고 / 문구+시간]의 3줄 격자다. 위·아래 빈 칸이 같은 크기(1fr)라 로고가 원의 정확한 가운데에 오고,
  // 문구와 시간은 로고 바로 아래에 이어 붙는다.
  return (
    <div role="status" className={`relative ${className ?? 'h-[min(20rem,60vmin)] w-[min(20rem,60vmin)]'}`}>
      <div className="absolute inset-0 animate-spin rounded-full border-[6px] border-gray-600 border-t-[var(--accent)]" />
      <div className="absolute inset-0 grid grid-rows-[1fr_auto_1fr] justify-items-center">
        <div />
        <MarketryLogo className="h-auto w-[72%]" />
        <div className="flex flex-col items-center gap-1 pt-4">
          <span className="text-base text-gray-300">데이터를 불러오는 중입니다.</span>
          <span className="h-7 text-base tabular-nums text-gray-300">{elapsedSeconds >= 1 ? `${elapsedSeconds}초` : ''}</span>
        </div>
      </div>
    </div>
  )
}
