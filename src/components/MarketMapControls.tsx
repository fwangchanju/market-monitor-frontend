import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { MarketQuery } from '@/types/api'
import { accentColor } from '@/utils/accentPalette'
import { LONGEST_MARKET_PHASE, type MarketPhase } from '@/utils/tradingWindow'
import { useMarketPhase } from '@/hooks/useMarketPhase'
import { FONT_BAR_TIME } from '@/components/FontStyle'
import { HINT_BUBBLE_CLASS } from '@/components/hintBubbleStyle'

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
        className="inline-flex h-6 w-[7.5rem] shrink-0 items-center justify-between gap-1 rounded-md border-0 bg-[#3b3b3b] px-2 text-sm font-bold text-white hover:bg-[#484848]"
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
        className="inline-flex h-6 w-28 shrink-0 items-center justify-between gap-1 rounded-md border-0 bg-[#3b3b3b] px-2 text-sm font-bold text-white hover:bg-[#484848]"
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

// 시간대 말머리 앞 점의 색 — 모두 설정창 색상 탭 4-1(강조 색상)의 색이다. 프리 마켓은 노랑, 애프터 마켓은 보라, 정규 시장은 청록(홈페이지 메인색과
// 같은 색), 사이의 동시 호가는 주황, 시장 마감은 연회색이다.
const PHASE_DOT_COLOR: Record<MarketPhase, string> = {
  '프리 마켓': accentColor('연노랑'),
  '동시 호가': accentColor('주황'),
  '정규 시장': accentColor('청록'),
  '애프터 마켓': accentColor('보라'),
  '시장 마감': accentColor('연회색'),
}

// 등락률 기준 토글 — 누적(전일 종가 대비) / 따로(당일 종가 대비). 항상 보이지만 따로 등락률은 15:40 이후 오늘 스냅샷에서만 있어서
// 그 밖에는 따로가 잠겨 있고 누적으로 보인다. 글자는 옆의 시각과 같은 크기·굵기(FONT_BAR_TIME)이고 버튼 높이는 그 글자에 맞췄다.
// 바탕은 위 드롭박스와 같은 회색(#3b3b3b)이고, 선택된 쪽은 브랜드색 글자에 옅은 브랜드색 배경으로 칠한다.
// 버튼을 누르면 그 버튼 아래에 설명 팝업이 뜬다(새로고침 버튼의 설명창과 같은 모양). 잠긴 따로도 눌러서 설명을 볼 수 있다.
export function ChangeRateBasisToggle({ basis, selectable, onChange }: {
  basis: 'daily' | 'afterHours'
  selectable: boolean
  onChange: (basis: 'daily' | 'afterHours') => void
}) {
  const options = [
    { value: 'daily' as const, label: '누적', help: <><b>전일</b> 종가 대비</>, locked: false },
    {
      value: 'afterHours' as const,
      label: '따로',
      help: (
        <>
          <b>당일</b> 종가 대비
          <br />
          15:40 부터 가능
        </>
      ),
      locked: !selectable,
    },
  ]
  // 말머리는 지금 시간대 이름이다 — 08:00~08:50 프리 마켓, 08:50~09:00 동시 호가, 09:00~15:30 정규 시장, 15:40~20:00 애프터 마켓(그 밖에는 시장 마감).
  const phase = useMarketPhase()
  const [popup, setPopup] = useState<{ text: ReactNode; anchor: DOMRect } | null>(null)
  const popupRef = useRef<HTMLSpanElement>(null)
  // 버튼 아래(4px)에 붙이고, 화면 밖으로 나가면 안쪽으로 밀거나 위로 뒤집는다 — 새로고침 버튼의 설명창과 같은 배치.
  // 크기를 잰 뒤 DOM 위치만 직접 고쳐서(상태를 다시 설정하지 않는다) 한 번에 자리를 잡는다.
  useLayoutEffect(() => {
    const element = popupRef.current
    if (!popup || !element) return
    const tooltip = element.getBoundingClientRect()
    const margin = 8
    const left = Math.max(margin, Math.min(popup.anchor.left, window.innerWidth - tooltip.width - margin))
    let top = popup.anchor.bottom + 4
    if (top + tooltip.height > window.innerHeight - margin) {
      const above = popup.anchor.top - tooltip.height - 4
      top = above >= margin ? above : Math.max(margin, window.innerHeight - tooltip.height - margin)
    }
    element.style.left = `${left}px`
    element.style.top = `${top}px`
  }, [popup])

  // 팝업 바깥을 누르거나 Esc를 누르거나 4초가 지나면 닫는다.
  useEffect(() => {
    if (!popup) return
    const close = () => setPopup(null)
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-basis-toggle]')) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const timer = window.setTimeout(close, 4000)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
    }
  }, [popup])

  return (
    <div className="-mr-[5px] flex shrink-0 items-center gap-2 whitespace-nowrap" data-basis-toggle>
      {/* 지금 시장 시간대를 알려주는 말머리 — 시계와 같은 글자 크기·색이다. */}
      <span className={`${FONT_BAR_TIME} flex items-center text-gray-400`}>
        {/* 상단바의 "● KRX·NXT"와 같은 점 모양이고, 색은 시간대마다 설정창 4-1(강조 색상)의 색이다. */}
        <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PHASE_DOT_COLOR[phase] }} />
        {/* 가장 긴 이름(애프터 마켓)을 보이지 않게 같은 자리에 겹쳐서 너비를 잡는다 — 시간대가 바뀌어도 점과 글자의 시작 위치가 같고, 짧은 이름은 왼쪽부터 쓴다. */}
        <span className="grid">
          <span aria-hidden="true" className="invisible col-start-1 row-start-1">{LONGEST_MARKET_PHASE}</span>
          <span className="col-start-1 row-start-1">{phase}</span>
        </span>
      </span>
      <div role="radiogroup" aria-label="등락률 기준" className="inline-flex h-6 shrink-0 items-center rounded-md bg-[#3b3b3b] p-0.5">
        {options.map(option => (
          // disabled를 쓰지 않는다 — 비활성 버튼은 클릭 이벤트가 없어서 잠긴 따로의 설명을 볼 수 없다. 잠긴 동안은 값만 안 바꾼다.
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={basis === option.value}
            aria-disabled={option.locked}
            onClick={event => {
              if (!option.locked && basis !== option.value) onChange(option.value)
              setPopup({ text: option.help, anchor: event.currentTarget.getBoundingClientRect() })
            }}
            className={`h-5 rounded-sm px-1.5 text-sm font-bold transition-colors ${
              basis === option.value
                ? 'border-0 bg-[#484848] text-[var(--accent)]'
                : option.locked
                  ? 'cursor-not-allowed border-0 bg-transparent text-gray-500'
                  : 'border-0 bg-transparent text-white hover:bg-[#484848]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {popup && (
        <span
          ref={popupRef}
          role="tooltip"
          data-basis-toggle
          style={{ position: 'fixed', left: popup.anchor.left, top: popup.anchor.bottom + 4 }}
          className={`z-50 w-max max-w-64 whitespace-pre-line font-normal ${HINT_BUBBLE_CLASS}`}
        >
          {popup.text}
        </span>
      )}
    </div>
  )
}
