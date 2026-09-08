import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  onCommit: (value: number) => void
  min?: number
  max?: number
  step?: number
  // min/max로 자른 값을 한 번 더 검증해서 실제로 반영할 값을 정한다. null을 반환하면 커밋을 거부하고
  // draft를 마지막으로 반영된 값으로 되돌린다 — 예: 섹터 페이지처럼 데이터가 5분 단위로만 존재하는
  // 구조적 제약을 화면에서 미리 막을 때 쓴다.
  validate?: (clamped: number) => number | null
  disabled?: boolean
  className?: string
}

// 네이티브 <input type="number"> 스핀 버튼은 브라우저마다 숨기는 CSS가 달라서(Firefox는
// -moz-appearance가 따로 필요) appearance-none 트릭만으론 안 먹는 경우가 있다. 그래서 아예
// type="text"로 두고 증감 버튼을 입력박스 밖에 커스텀으로 배치한다 — 항상 같은 자리에 보이니
// 포커스해도 레이아웃이 흔들리지 않는다. 타이핑 중에는 draft(로컬 텍스트)만 바뀌고, Enter나
// blur에서만 실제 값을 반영한다 — 키 입력마다 바로 반영하면 유효하지 않은 중간 상태(예: 섹터
// 페이지에서 "3"을 치는 순간)에서 데이터 요청이 곧바로 실패해 사실상 타이핑을 이어갈 수 없는
// 문제가 있었다.
export default function NumberStepperInput({ value, onCommit, min, max, step = 1, validate, disabled, className }: Props) {
  const [draft, setDraft] = useState(String(value))
  const isFocusedRef = useRef(false)

  useEffect(() => {
    if (!isFocusedRef.current) setDraft(String(value))
  }, [value])

  const clamp = (raw: number): number => {
    let next = raw
    if (min != null) next = Math.max(min, next)
    if (max != null) next = Math.min(max, next)
    return next
  }

  const resolve = (raw: number): number | null => {
    const clamped = clamp(raw)
    return validate ? validate(clamped) : clamped
  }

  const commit = (finalValue: number | null) => {
    if (finalValue == null) {
      setDraft(String(value))
      return
    }
    setDraft(String(finalValue))
    if (finalValue !== value) onCommit(finalValue)
  }

  const tryCommitDraft = () => {
    const parsed = Number(draft)
    if (draft.trim() === '' || Number.isNaN(parsed)) {
      setDraft(String(value))
      return
    }
    commit(resolve(parsed))
  }

  const handleStep = (direction: 1 | -1) => commit(resolve(value + direction * step))

  return (
    <span className="group inline-flex items-stretch">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        onFocus={() => {
          isFocusedRef.current = true
        }}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        onBlur={() => {
          isFocusedRef.current = false
          tryCommitDraft()
        }}
        className={className}
      />
      {/* 입력박스에 커서가 있을 때(또는 버튼 자체에 포커스가 옮겨갔을 때)만 보이게 — 평소엔 숨겨서
          화면을 덜 어수선하게 한다. invisible은 visibility:hidden이라 안 보일 때 클릭도 안 먹는다. */}
      <span className="invisible ml-0.5 flex flex-col overflow-hidden rounded border border-gray-600 group-focus-within:visible">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => handleStep(1)}
          aria-label="증가"
          className="flex h-1/2 w-4 items-center justify-center bg-zinc-900 text-[9px] leading-none text-gray-400 hover:bg-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          ▲
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => handleStep(-1)}
          aria-label="감소"
          className="flex h-1/2 w-4 items-center justify-center border-t border-gray-600 bg-zinc-900 text-[9px] leading-none text-gray-400 hover:bg-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          ▼
        </button>
      </span>
    </span>
  )
}
