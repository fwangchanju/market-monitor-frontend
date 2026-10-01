import { useEffect, useRef, useState } from 'react'
import { HEATMAP_NAMES } from '@/utils/heatmapNames'

export type CustomHeatmapSheet = 'marketry' | 'krx' | 'nxt'

// 지도 설정의 히트맵 선택과 같은 순서다. sheet가 null인 항목(내 히트맵)은 아직 시트가 없어 고를 수 없다.
const OPTIONS: readonly { sheet: CustomHeatmapSheet | null; label: string }[] = [
  { sheet: null, label: HEATMAP_NAMES.mine.tab },
  { sheet: 'krx', label: HEATMAP_NAMES.krx.tab },
  { sheet: 'nxt', label: HEATMAP_NAMES.nxt.tab },
  { sheet: 'marketry', label: HEATMAP_NAMES.marketry.tab },
]

// 커스텀 페이지의 히트맵 시트 선택 — 지도 화면의 시장 선택 드롭박스와 같은 모양이다.
export default function CustomHeatmapSheetCombobox({ sheet, onSelect }: {
  sheet: CustomHeatmapSheet
  onSelect: (sheet: CustomHeatmapSheet) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = OPTIONS.find(option => option.sheet === sheet) ?? OPTIONS[OPTIONS.length - 1]

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={rootRef} className="relative z-40 flex items-center font-roboto-latin tabular-nums">
      <button
        type="button"
        role="combobox"
        aria-label="히트맵 시트 선택"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen(open => !open)}
        className="inline-flex h-7 w-[7.5rem] shrink-0 items-center justify-between gap-1 rounded-md border-0 bg-[#3b3b3b] px-2 text-sm font-bold text-white hover:bg-[#484848]"
      >
        <span className="min-w-0 flex-1 truncate text-left">{selected.label}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 w-[7.5rem] rounded-md bg-[#202020] p-2 text-sm text-white shadow-md">
          <div role="listbox" aria-label="히트맵 시트 목록">
            {OPTIONS.map(option => (
              <button
                key={option.label}
                type="button"
                role="option"
                aria-selected={option.sheet !== null && sheet === option.sheet}
                disabled={option.sheet === null}
                title={option.sheet === null ? '준비 중' : undefined}
                onClick={() => {
                  if (option.sheet === null) return
                  onSelect(option.sheet)
                  setIsOpen(false)
                }}
                className={`block w-full border-0 bg-transparent px-2.5 py-2 text-left disabled:cursor-not-allowed disabled:text-gray-500 ${sheet === option.sheet ? 'font-semibold text-[var(--accent)]' : 'text-gray-300 hover:text-white'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
