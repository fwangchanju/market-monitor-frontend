import { useEffect, useRef, useState } from 'react'
import type { MarketQuery } from '@/types/api'
import { FONT_BAR_TIME } from '@/components/FontStyle'

const MARKET_LABEL: Record<MarketQuery, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ', ALL_STOCK: 'ALL STOCK' }
const MARKET_OPTIONS: { market: MarketQuery; label: string }[] = [
  { market: 'ALL_STOCK', label: 'ALL STOCK' },
  { market: 'KOSPI', label: 'KOSPI' },
  { market: 'KOSDAQ', label: 'KOSDAQ' },
]
const TIME_PERIODS = ['1 DAY', '1 WEEK', '1 MONTH', '3 MONTH', '6 MONTH', '1 YEAR', 'WTD', 'MTD', 'YTD'] as const

export function MarketMapMarketCombobox({
  market,
  onSelect,
}: {
  market: MarketQuery
  onSelect: (market: MarketQuery) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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
        aria-label="시장 선택"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen(open => !open)}
        className="inline-flex h-7 w-[7.5rem] shrink-0 items-center justify-between gap-1 rounded-md border-0 bg-[#3b3b3b] px-2 text-sm font-bold text-white hover:bg-[#484848]"
      >
        <span className="min-w-0 flex-1 truncate text-left">{MARKET_LABEL[market]}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 w-[7.5rem] rounded-md bg-[#202020] p-2 text-sm text-white shadow-md">
          <div role="listbox" aria-label="시장 목록">
            {MARKET_OPTIONS.map(option => (
              <button
                key={option.market}
                type="button"
                role="option"
                aria-selected={market === option.market}
                onClick={() => {
                  onSelect(option.market)
                  setIsOpen(false)
                }}
                className={`block w-full border-0 bg-transparent px-2.5 py-2 text-left ${market === option.market ? 'font-semibold text-[var(--accent)]' : 'text-gray-300 hover:text-white'}`}
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

export function MarketMapPeriodCombobox() {
  const [selectedPeriod, setSelectedPeriod] = useState<(typeof TIME_PERIODS)[number]>('1 DAY')
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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
        aria-label="기간 선택"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen(open => !open)}
        className="inline-flex h-7 w-28 shrink-0 items-center justify-between gap-1 rounded-md border-0 bg-[#3b3b3b] px-2 text-sm font-bold text-white hover:bg-[#484848]"
      >
        <span className="min-w-0 flex-1 truncate text-left">{selectedPeriod}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 w-28 rounded-md bg-[#202020] p-2 text-sm text-white shadow-md">
          <div role="listbox" aria-label="기간 목록">
            {TIME_PERIODS.map((period, index) => (
              <button
                key={period}
                type="button"
                role="option"
                aria-selected={selectedPeriod === period}
                disabled={period !== '1 DAY'}
                title={period === '1 DAY' ? undefined : '준비 중'}
                onClick={() => {
                  setSelectedPeriod(period)
                  setIsOpen(false)
                }}
                className={`block w-full border-0 bg-transparent px-2.5 py-2 text-left disabled:cursor-not-allowed ${index === 6 ? 'mt-1 border-t border-[#555] pt-3' : ''} ${selectedPeriod === period ? 'font-semibold text-[var(--accent)]' : period === '1 DAY' ? 'text-gray-300 hover:text-white' : 'text-gray-600'}`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 등락률 기준 토글 — 누적(전일 종가 대비 누적) / 따로(그날 정규장 종가 대비, 장 마감 후 움직임만 따로). 항상 보이지만 따로 등락률은
// 15:40 이후 오늘 스냅샷에서만 있어서 그 밖에는 따로가 잠겨 있고 누적으로 보인다. 글자는 옆의 시각과 같은 크기·굵기(FONT_BAR_TIME)이고 버튼 높이는
// 그 글자에 맞췄다. 바탕은 위 드롭박스와 같은 회색(#3b3b3b)이고, 선택된 쪽은 브랜드색 글자에 옅은 브랜드색 배경으로 칠한다.
export function ChangeRateBasisToggle({ basis, selectable, onChange }: {
  basis: 'daily' | 'afterHours'
  selectable: boolean
  onChange: (basis: 'daily' | 'afterHours') => void
}) {
  const options = [
    { value: 'daily' as const, label: '누적', title: '전일 종가 대비 누적 등락률', disabled: false },
    {
      value: 'afterHours' as const,
      label: '따로',
      title: selectable ? '정규장 종가(15:30) 대비 등락률 — 장 마감 후 움직임만 따로' : '따로 등락률은 15:40 이후에 볼 수 있습니다',
      disabled: !selectable,
    },
  ]
  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
      {/* 버튼이 무엇을 고르는 것인지 알려주는 말머리 — 시계와 같은 글자 크기·색이다. */}
      <span className={`${FONT_BAR_TIME} flex items-center text-gray-400`}>
        {/* 상단바의 "● KRX·NXT"와 같은 점 모양이고, 색은 강조색(--brand)이다. */}
        <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--brand)]" />
        After-Market
      </span>
      <div role="radiogroup" aria-label="등락률 기준" className="inline-flex h-6 shrink-0 items-center rounded-md bg-[#3b3b3b] p-0.5">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={basis === option.value}
          disabled={option.disabled}
          title={option.title}
          onClick={() => basis !== option.value && onChange(option.value)}
          className={`h-5 rounded-sm px-1 ${FONT_BAR_TIME} transition-colors ${
            basis === option.value
              ? 'border-0 bg-[var(--brand)]/25 text-[var(--brand)]'
              : option.disabled
                ? 'cursor-not-allowed border-0 bg-transparent text-gray-500'
                : 'border-0 bg-transparent text-gray-300 hover:text-white'
          }`}
        >
          {option.label}
        </button>
      ))}
      </div>
    </div>
  )
}
