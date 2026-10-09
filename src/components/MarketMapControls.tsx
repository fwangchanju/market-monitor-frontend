import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { MarketQuery } from '@/types/api'
import { accentColor } from '@/utils/accentPalette'
import { LONGEST_TRADING_SESSION, type TradingSession } from '@/utils/tradingWindow'
import { useTradingSession } from '@/hooks/useTradingSession'
import { FONT_BAR_TIME } from '@/components/FontStyle'
import { HINT_BUBBLE_CLASS } from '@/components/hintBubbleStyle'

const MARKET_LABEL: Record<MarketQuery, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ', ALL_STOCK: 'ALL STOCK' }
// 순서는 KOSPI / KOSDAQ / ALL STOCK이다(지도·그룹 화면 공통).
const MARKET_OPTIONS: { market: MarketQuery; label: string }[] = [
  { market: 'KOSPI', label: 'KOSPI' },
  { market: 'KOSDAQ', label: 'KOSDAQ' },
  { market: 'ALL_STOCK', label: 'ALL STOCK' },
]
const TIME_PERIODS = ['1 DAY', '1 WEEK', '1 MONTH', '3 MONTH', '6 MONTH', '1 YEAR', 'WTD', 'MTD', 'YTD'] as const

export function MarketDropdown({
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

export function PeriodDropdown() {
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

// 시간대 말머리 앞 점의 색 — 설정창 4-1) 강조 색상 기준으로 프리 마켓은 연노랑,
// 메인 마켓은 형광, 애프터 마켓은 주황, 마켓 종료은 연회색이다.
const SESSION_DOT_COLOR: Record<TradingSession, string> = {
  '프리 마켓': accentColor('연노랑'),
  '메인 마켓': accentColor('형광'),
  '애프터 마켓': accentColor('주황'),
  '마켓 종료': accentColor('연회색'),
}

// 지도·그룹 페이지가 같은 시간대 문구와 강조 색상을 사용한다.
export function TradingSessionIndicator() {
  const session = useTradingSession()
  return (
    <span className={`${FONT_BAR_TIME} flex items-center text-gray-400`}>
      <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SESSION_DOT_COLOR[session] }} />
      {/* 가장 긴 이름으로 너비를 유지해 시간대가 바뀌어도 옆 항목이 움직이지 않게 한다. */}
      <span className="grid">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1">{LONGEST_TRADING_SESSION}</span>
        <span className="col-start-1 row-start-1">{session}</span>
      </span>
    </span>
  )
}

// 등락률 기준 토글 — 누적(전일 종가 대비) / 따로(당일 종가 대비). 애프터 마켓 시작부터 다음 프리 마켓 개장 전까지만 보인다.
// 시간외 스냅샷이 아직 없으면 따로는 잠긴다. 시장 시간대 말머리는 버튼의 표시 여부와 무관하게 유지한다.
// 버튼을 누르면 그 버튼 아래에 설명 팝업이 뜬다(새로고침 버튼의 설명창과 같은 모양). 잠긴 따로도 눌러서 설명을 볼 수 있다.
export function ChangeRateModeToggle({ basis, visible, selectable, onChange }: {
  basis: 'daily' | 'afterHours'
  visible: boolean
  selectable: boolean
  onChange: (basis: 'daily' | 'afterHours') => void
}) {
  const options = [
    { value: 'daily' as const, label: '누적', help: <><b className="text-red-600">전일</b> 종가 대비</>, locked: false },
    {
      value: 'afterHours' as const,
      label: '따로',
      help: (
        <>
          <b className="text-red-600">당일</b> 종가 대비
          <br />
          15:40 부터
        </>
      ),
      locked: !selectable,
    },
  ]
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
      <TradingSessionIndicator />
      {visible && <div
        role="radiogroup"
        aria-label="등락률 기준"
        className="inline-flex h-6 w-16 shrink-0 items-center overflow-visible rounded-none bg-[#202020] p-0.5"
      >
        {options.map(option => (
          // disabled를 쓰지 않는다 — 비활성 버튼은 클릭 이벤트가 없어서 잠긴 따로의 설명을 볼 수 없다. 잠긴 동안은 값만 안 바꾼다.
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={basis === option.value}
            aria-disabled={option.locked}
            style={basis === option.value
              ? {
                  color: '#111827',
                  backgroundColor: SESSION_DOT_COLOR['애프터 마켓'],
                  borderRadius: 0,
                  boxShadow: 'inset 0 1px 1px rgb(255 255 255 / 45%), inset 0 -1px 1px rgb(0 0 0 / 18%)',
                }
              : {
                  color: option.locked ? '#737373' : '#d1d5db',
                  backgroundColor: 'transparent',
                  borderRadius: 0,
                  outline: `1px solid ${SESSION_DOT_COLOR['애프터 마켓']}`,
                  outlineOffset: '-1px',
                  boxShadow: 'inset 0 1px 2px rgb(0 0 0 / 48%), inset 0 -1px 1px rgb(255 255 255 / 12%)',
                }}
            onClick={event => {
              if (!option.locked && basis !== option.value) onChange(option.value)
              setPopup({ text: option.help, anchor: event.currentTarget.getBoundingClientRect() })
            }}
            className={`h-5 min-w-0 flex-1 rounded-none border-0 px-0 text-sm font-bold leading-none transition-all ${
              basis !== option.value && option.locked ? 'cursor-not-allowed' : ''
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>}
      {visible && popup && (
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
