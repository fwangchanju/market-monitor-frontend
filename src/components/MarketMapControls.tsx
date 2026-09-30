import { useEffect, useRef, useState } from 'react'
import type { MarketQuery } from '@/types/api'

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
