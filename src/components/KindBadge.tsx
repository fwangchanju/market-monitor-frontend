import { useEffect, useRef, useState } from 'react'
import { useTaxonomySelection } from '@/hooks/useTaxonomySelection'

// 종목/업종 구분 배지 — 지도에서 업종 헤더·종목 박스를 우클릭했을 때 뜨는 팝업의 제목 앞 배지와 같은 모양이다.
// 설정창 위쪽의 "nn/nn종목" 개수 표시도 글자 대신 이 배지를 쓴다.
export type Kind = '종목' | '업종'

// onDark: 어두운 바탕(설정창)에서는 업종·종목 모두 옆의 개수 숫자와 같은 회색이다. 팝업의 연한 바탕에서는 업종 청록, 종목 진한 회색이다.
export default function KindBadge({ kind, onDark = false, className = '' }: { kind: Kind; onDark?: boolean; className?: string }) {
  const tone = onDark ? 'text-gray-400' : kind === '업종' ? 'text-[var(--brand)]' : 'text-gray-500'
  return (
    <span className={`shrink-0 rounded-sm border border-current px-1 py-0.5 text-xs font-medium leading-none ${tone} ${className}`}>
      {kind}
    </span>
  )
}

// "12/30종목" 같은 개수 글자를 "12/30 [종목]"(숫자가 앞, 배지가 바로 뒤)으로 그린다. 숫자의 천 단위 쉼표는 뺀다. 끝이 종목/업종이 아니면 글자 그대로 둔다.
// 분자가 바뀔 때 청록색으로 잠깐 보이게 하는 훅 — 설정(제외 업종·구간 등)을 바꿔 숫자가 변했다는 신호다.
// 번쩍이지 않는 경우: 처음 그릴 때, 분모가 같이 바뀔 때(시장 변경·데이터 로딩), 분류 기준을 바꾼 직후 1.5초(새 데이터가 도착하며 분자가 달라지는 때).
// 슬라이더처럼 연속으로 바뀌는 동안은 청록색을 유지하고, 멈춘 뒤 0.6초 지나면 원래 색으로 돌아온다.
const FLASH_HOLD_MS = 600
const FLASH_SUPPRESS_AFTER_TAXONOMY_MS = 1500

function useFlashOnNumeratorChange(numerator: string, denominator: string) {
  const [taxonomy] = useTaxonomySelection()
  const [isFlashing, setIsFlashing] = useState(false)
  const previous = useRef<{ numerator: string; denominator: string; taxonomy: string } | null>(null)
  const suppressUntil = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const before = previous.current
    previous.current = { numerator, denominator, taxonomy }
    if (!before) return
    if (before.taxonomy !== taxonomy) {
      suppressUntil.current = Date.now() + FLASH_SUPPRESS_AFTER_TAXONOMY_MS
      return
    }
    if (before.denominator !== denominator || before.numerator === numerator) return
    if (Date.now() < suppressUntil.current) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 값이 바뀐 순간에만 켜고 타이머로 끄는 일회성 시각 효과라 렌더 중에 계산할 수 없다
    setIsFlashing(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setIsFlashing(false), FLASH_HOLD_MS)
  }, [numerator, denominator, taxonomy])

  useEffect(() => () => window.clearTimeout(timer.current), [])
  return isFlashing
}

// "449/2741종목" → "449/2741 [종목]"(숫자가 앞, 배지가 바로 뒤). align이 end면 숫자와 배지를 칸의 오른쪽 끝에 붙인다.
// 배지는 글자 수가 같은(2글자) 종목/업종이라 칸 오른쪽 끝에서 항상 같은 자리에 오고, 숫자만 자릿수만큼 왼쪽으로 늘어난다.
export function CountLabelWithBadge({ label, alignEnd = false }: { label: string; alignEnd?: boolean }) {
  const match = /^(.*?)(종목|업종)$/.exec(label)
  const [numerator = '', denominator = ''] = (match?.[1] ?? '').replaceAll(',', '').split('/')
  const isFlashing = useFlashOnNumeratorChange(numerator, denominator)
  if (!match) return <>{label}</>
  return (
    <span className={`items-center gap-1.5 ${alignEnd ? 'flex w-full justify-end' : 'inline-flex'}`}>
      <span>
        <span className={`transition-colors duration-300 ${isFlashing ? 'text-[var(--brand)]' : ''}`}>{numerator}</span>
        {denominator && `/${denominator}`}
      </span>
      <KindBadge kind={match[2] as Kind} onDark />
    </span>
  )
}
