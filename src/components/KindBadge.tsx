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

// "12/30종목" 같은 개수 글자를 "[종목] 12/30"(배지가 앞, 숫자가 바로 뒤)으로 그린다. 숫자의 천 단위 쉼표는 뺀다. 끝이 종목/업종이 아니면 글자 그대로 둔다.
// spread면 배지는 칸의 왼쪽 끝에, 숫자는 오른쪽 끝에 붙인다(숫자 자릿수가 달라도 배지 자리는 그대로).
export function CountLabelWithBadge({ label, spread = false }: { label: string; spread?: boolean }) {
  const match = /^(.*?)(종목|업종)$/.exec(label)
  if (!match) return <>{label}</>
  return (
    <span className={spread ? 'flex w-full items-center justify-between gap-1.5' : 'inline-flex items-center gap-1.5'}>
      <KindBadge kind={match[2] as Kind} onDark />
      <span>{match[1].replaceAll(',', '')}</span>
    </span>
  )
}
