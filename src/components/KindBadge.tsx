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

// "12/30종목" 같은 개수 글자를 "12/30 [종목]"(뒤 단어만 배지)으로 그린다. 끝이 종목/업종이 아니면 글자 그대로 둔다.
export function CountLabelWithBadge({ label }: { label: string }) {
  const match = /^(.*?)(종목|업종)$/.exec(label)
  if (!match) return <>{label}</>
  return (
    <span className="inline-flex items-center gap-1">
      <span>{match[1]}</span>
      <KindBadge kind={match[2] as Kind} onDark />
    </span>
  )
}
