// 버튼 묶음(radiogroup)에서 선택 칸의 색 채움을 옆으로 미끄러뜨리는 막대.
// 묶음은 `relative`이고 `p-0.5`에 같은 폭의 칸 `count`개(grid-cols-N)여야 한다. 칸 버튼은 `relative z-10`에 배경 없이 글자색만 바꾼다.
// 칸 폭의 배수만큼 transform으로 옮기기 때문에 크기를 재지 않고, 다시 배치(layout)도 일으키지 않는다.
export function SlidingHighlight({ count, index, className }: { count: number; index: number; className: string }) {
  if (index < 0) return null
  return (
    <span
      aria-hidden="true"
      className={`absolute bottom-0.5 left-0.5 top-0.5 transition-transform duration-[400ms] ease-out ${className}`}
      style={{ width: `calc((100% - 4px) / ${count})`, transform: `translateX(${index * 100}%)` }}
    />
  )
}
