import { Children, Fragment, createContext, isValidElement, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import type { DepthMetric } from '@/hooks/useGlobalSettings'
import type { StockChangeFilter, SectorChangeFilter } from '@/hooks/useFilteredMarketMapTree'
import type { ColorScaleConfig, LegendSwatch } from '@/utils/marketMapColorScale'
import MarketMapColorThresholdEditorPanel, { type ColorThresholdEditorProps } from '@/components/MarketMapColorThresholdEditorPanel'
import SettingsSectionIcon, { type SettingsSectionIconName } from '@/components/SettingsSectionIcon'
import { RestoreToMapIcon } from '@/components/icons/MarketMapIcons'
import type { MarketValueTierItem } from '@/types/api'
import { FONT_BAR_TIME } from '@/components/FontStyle'
import { HEATMAP_NAMES, type HeatmapKey } from '@/utils/heatmapNames'
import { toMarketMapSnapshotDateLabel, toMarketMapSnapshotTimeOnlyLabel } from '@/utils/format'
import { BOOKMARK_ORDER, type SettingsBookmarkId } from '@/utils/settingsBookmarks'

export type { SettingsBookmarkId }
export type SettingsSidebarSectionId = 'favorites' | 'composition' | 'industry' | 'stockDisplay' | 'colors'

interface SettingsSidebarGroupProps {
  section: SettingsSidebarSectionId
  children?: ReactNode
}

// 각 페이지가 자기 설정을 참조 탭 아래에 배치한다. SettingsSidebar는 활성 탭의 그룹만 렌더링한다.
export function SettingsSidebarGroup({ children }: SettingsSidebarGroupProps) {
  return <>{children}</>
}

// 제목 바로 아래에 항상 보이는 한 줄 설명 — 제목만으로 뜻이 안 와닿는 항목을 물음표 없이 이해하게 한다.
// 한 줄(16px) + 위 간격(4px)이라 높이를 20px로 계산해서 index.css의 탭 정렬 값을 맞춘다.
function SettingDescription({ children }: { children: ReactNode }) {
  return <p className="settings-description mt-1 max-w-[16rem] text-xs text-gray-400">{children}</p>
}

function SettingHelpIcon({ label, description, bookmarkId }: { label: string; description: ReactNode; bookmarkId?: SettingsBookmarkId }) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ left: 8, top: 8 })

  useLayoutEffect(() => {
    if (!isOpen) return

    const updatePosition = () => {
      const anchor = buttonRef.current?.getBoundingClientRect()
      const tooltip = tooltipRef.current?.getBoundingClientRect()
      if (!anchor || !tooltip) return

      const margin = 8
      const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - tooltip.width - margin))
      let top = anchor.bottom + 4
      if (top + tooltip.height > window.innerHeight - margin) {
        const above = anchor.top - tooltip.height - 4
        top = above >= margin ? above : Math.max(margin, window.innerHeight - tooltip.height - margin)
      }
      setTooltipPosition({ left, top })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen])

  return (
    <>
    <span className="relative ml-1 inline-flex shrink-0 align-middle">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${label} 설명`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        onBlur={event => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setIsOpen(false)
        }}
        className="inline-flex h-4 w-4 items-center justify-center border-0 bg-transparent p-0 text-gray-400 hover:text-gray-200 focus-visible:outline focus-visible:outline-1"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6.35" />
          <path d="M6.25 6.05a1.85 1.85 0 1 1 3.55.78c-.48.86-1.8 1.06-1.8 2.52" />
          <circle cx="8" cy="11.75" r="0.55" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {isOpen && (
        <span
          ref={tooltipRef}
          role="tooltip"
          style={{ position: 'fixed', left: tooltipPosition.left, top: tooltipPosition.top }}
          className="z-50 w-64 max-w-[calc(100vw-16px)] whitespace-pre-line rounded border border-[#7a6d55] bg-[#fff8e7] p-2 text-left text-xs leading-relaxed text-black shadow-lg"
        >
          {description}
        </span>
      )}
    </span>
    {bookmarkId && <BookmarkButton id={bookmarkId} label={label} />}
    </>
  )
}

// 북마크한 설정 항목을 북마크 탭에 그대로 다시 그리기 위한 공유 상태. 항목 컴포넌트는 같은 코드를 두 곳(원래 탭,
// 북마크 탭)에서 쓰고, mode로 어디서 그려지는지 구분한다. 북마크 기능을 켜지 않은 페이지는 enabled=false라 아무것도 안 보인다.
interface SettingsBookmarkContextValue {
  enabled: boolean
  mode: 'source' | 'bookmark'
  ids: readonly string[]
  // 북마크 탭에서 보여줄 "원래 위치" 번호(예: "1-2") — 탭 번호-항목 번호.
  numbers: Partial<Record<SettingsBookmarkId, string>>
  // 북마크 탭에서 맨 위에 보이는 항목 — 이 항목 위에는 구분선을 긋지 않는다.
  firstId?: SettingsBookmarkId
  onToggle: (id: SettingsBookmarkId) => void
}

const SettingsBookmarkContext = createContext<SettingsBookmarkContextValue>({
  enabled: false,
  mode: 'source',
  ids: [],
  numbers: {},
  onToggle: () => {},
})

// 북마크 탭에서 항목 컨테이너에 붙일 클래스 — 북마크하지 않은 항목은 숨기고, 보이는 항목은 같은 높이 규칙을 따른다.
function bookmarkItemClass(ctx: SettingsBookmarkContextValue, id: SettingsBookmarkId) {
  if (ctx.mode !== 'bookmark') return ''
  if (!ctx.ids.includes(id)) return 'hidden'
  return `settings-bookmark-item ${ctx.firstId === id ? 'settings-bookmark-first' : ''}`
}

function BookmarkButton({ id, label }: { id: SettingsBookmarkId; label: string }) {
  const { enabled, ids, onToggle } = useContext(SettingsBookmarkContext)
  if (!enabled) return null
  const active = ids.includes(id)
  return (
    <button
      type="button"
      aria-label={`${label} 북마크${active ? ' 해제' : ''}`}
      aria-pressed={active}
      title={active ? '북마크 해제' : '북마크에 추가'}
      onClick={() => onToggle(id)}
      className={`ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center border-0 bg-transparent p-0 ${active ? 'text-[var(--brand)]' : 'text-gray-400 hover:text-gray-200'}`}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round">
        <path d="M4 2.2h8a.8.8 0 0 1 .8.8v10.8L8 10.6 3.2 13.8V3a.8.8 0 0 1 .8-.8Z" />
      </svg>
    </button>
  )
}

// 항목 제목 + 북마크 버튼. 북마크 탭에서는 번호를 자동 카운터 대신 원래 위치 번호로 보여준다.
function SettingTitle({ bookmarkId, className = '', help = false, children }: { bookmarkId: SettingsBookmarkId; className?: string; help?: boolean; children: string }) {
  const { mode, numbers } = useContext(SettingsBookmarkContext)
  const number = mode === 'bookmark' ? numbers[bookmarkId] : undefined
  return (
    <>
      <span className={`settings-section-num ${number ? 'settings-bookmark-num' : ''} ${className}`} data-num={number}>{children}</span>
      {!help && <BookmarkButton id={bookmarkId} label={children} />}
    </>
  )
}

const SETTINGS_SECTIONS: { id: SettingsSidebarSectionId; label: string; icon: SettingsSectionIconName }[] = [
  { id: 'composition', label: '종목 구성', icon: 'composition' },
  { id: 'industry', label: '업종 표시', icon: 'industry' },
  { id: 'stockDisplay', label: '종목 박스', icon: 'stock-display' },
  { id: 'colors', label: '색상', icon: 'colors' },
  { id: 'favorites', label: '북마크', icon: 'favorites' },
]

function SettingsFavoritesPlaceholder() {
  return null
}

interface ExcludedSector {
  sectorId: number
  sectorName: string
}

// checked가 꺼지면 라벨 텍스트도 같이 옅어져서, 꺼져있다는 게 스위치 색뿐 아니라 글자로도 드러난다.
function ToggleSwitch({
  checked,
  onChange,
  label,
  labelSuffix,
  hint,
  disabled = false,
  bold = false,
  labelClassName = '',
  hideLabel = false,
  forceLabelWhite = false,
}: {
  checked: boolean
  onChange: () => void
  label: string
  // 라벨 바로 뒤(같은 왼쪽 그룹) 붙는 보조 콘텐츠 — 예: "커스텀 모드" 옆 "N/N종목" 표시.
  labelSuffix?: ReactNode
  hint?: string
  disabled?: boolean
  bold?: boolean
  labelClassName?: string
  // true면 라벨을 화면에 그리지 않고 스위치만 그린다(접근성용 aria-label은 label을 그대로 씀) —
  // 바깥에서 이미 같은 텍스트를 제목(예: "색상 범위")으로 보여주고 있어 중복 표시를 피할 때 쓴다.
  hideLabel?: boolean
  // true면 checked=false여도 라벨을 회색으로 옅게 하지 않고 흰색으로 그린다 — "동일 가중/시총 가중"처럼
  // OFF가 "꺼짐(비활성)"이 아니라 "다른 선택지가 켜짐"을 뜻하는 경우, label 자체가 항상 지금 선택된
  // 쪽을 나타내므로 checked 여부와 무관하게 항상 강조돼야 한다.
  forceLabelWhite?: boolean
  // 상위 설정과 같은 위계를 만들지 않을 작은 하위 옵션용 스위치.
  compact?: boolean
}) {
  // 라벨(+보조 콘텐츠)은 왼쪽에 모으고, 스위치는 justify-between으로 항상 이 줄의 우측 끝에 붙인다.
  return (
    <div className={`flex items-center justify-between gap-2 ${disabled ? 'opacity-40' : ''}`}>
      {!hideLabel && (
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`${labelClassName} ${bold ? 'font-bold' : ''} ${forceLabelWhite || checked ? 'text-white' : 'text-gray-500'}`}
          >
            {label}
          </span>
          {labelSuffix}
          {hint && <span className="text-[10.5px] text-gray-500">{hint}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        disabled={disabled}
        className={`relative h-4 w-7 shrink-0 appearance-none rounded-full border-0 p-0 shadow-none transition-colors ${checked ? 'bg-[var(--accent)]' : 'bg-gray-600'} ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`absolute top-1/2 left-0 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white transition-transform ${checked ? 'translate-x-3.5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}

// 뎁스 범위 슬라이더 인덱스는 뎁스에 직접 대응한다(0=대분류, 1=중분류, 2=소분류, ...).
const DEPTH_LABELS = ['대분류', '중분류', '소분류']

// 활성화는 제목 오른쪽 토글, 슬라이더는 표시할 개수만 선택한다.
const TOP_PICK_COUNT_LABELS = ['1개', '2개', '3개']

// 그룹 탭에는 이 중 하나만 표시한다.
const GROUP_TAB_METRIC_OPTIONS: { key: DepthMetric; label: string }[] = [
  { key: 'weightedAvgChangeRate', label: '시총 가중' },
  { key: 'simpleAvgChangeRate', label: '동일 가중' },
  { key: 'upDownCount', label: '등락 종목' },
  { key: 'marketValue', label: '그룹 시총' },
]

// 박스 내 표기 방식은 라디오형 세그먼트 컨트롤로 표시한다.
const STOCK_LABEL_MODE_LABELS = ['종목명', '등락률', '모두']

// 등락률 소수점 슬라이더 라벨 — 인덱스 그대로 소수점 자릿수(toPctSigned의 decimalPlaces 인자, 0=정수).
const DECIMAL_PLACES_LABELS = ['정수', '1자리', '2자리']

// 범위 슬라이더 핸들 안의 화살표. 유니코드 화살표는 16px 안에서 뭉개져서 SVG로 그린다.
function ChevronGlyph({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 8 12" className="h-2.5 w-2 shrink-0" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M6 1 2 6l4 5' : 'M2 1l4 5-4 5'}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// 핸들 크기는 SingleValueSlider(네이티브 range thumb, 16px)와 맞춘다.
const RANGE_HANDLE_CLASS =
  'pointer-events-none absolute top-1/2 flex h-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--accent)] text-black touch-none'
const BLOCKED_HINT_CLASS =
  'pointer-events-none absolute top-full left-0 z-50 mt-1 max-w-full rounded border border-[#7a6d55] bg-[#fff8e7] px-2 py-1 text-xs text-black shadow-lg'

// 업종 단계(대/중/소분류) 선택 드롭박스 — 업종 표시 단계(1-1)보다 깊은 단계는 비활성이고, 눌렀을 때 이유를 알려준다.
// 안내 말풍선은 열린 목록과 아래 컨트롤을 가리지 않도록 드롭박스 위쪽에 띄운다.
const DEPTH_SELECT_ARROW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E")`

function DepthSelect({
  depth,
  onChange,
  maxSelectableDepth,
  ariaLabel,
  disabled = false,
  className = '',
}: {
  depth: number
  onChange: (depth: number) => void
  maxSelectableDepth: number
  ariaLabel: string
  disabled?: boolean
  className?: string
}) {
  const [hintVisible, setHintVisible] = useState(false)
  const isCapped = DEPTH_LABELS.some((_, index) => index >= maxSelectableDepth)
  return (
    <span className={`relative inline-flex ${className}`} onPointerLeave={() => setHintVisible(false)}>
      <select
        aria-label={ariaLabel}
        value={depth}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        onPointerDown={() => { if (isCapped && !disabled) setHintVisible(true) }}
        className="h-6 w-[4.5rem] cursor-pointer appearance-none rounded border border-gray-600 bg-zinc-700 bg-[length:10px_6px] bg-[right_7px_center] bg-no-repeat py-0 pl-2 pr-5 text-xs text-white outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ backgroundImage: DEPTH_SELECT_ARROW }}
      >
        {DEPTH_LABELS.map((label, index) => (
          <option key={label} value={index} disabled={index >= maxSelectableDepth}>{label}</option>
        ))}
      </select>
      {hintVisible && isCapped && !disabled && (
        <div role="status" className="pointer-events-none absolute bottom-full right-0 z-50 mb-1 w-56 rounded border border-[#7a6d55] bg-[#fff8e7] px-2 py-1 text-xs text-black shadow-lg">
          <span className="inline-block whitespace-nowrap border-b border-current">1-1) 업종 표시 단계</span>를 높여야 선택이 가능합니다.
        </div>
      )}
    </span>
  )
}

// 양쪽 끝에 핸들이 있으면 전체 구간 다 보여주고, 핸들을 안쪽으로 옮기면 그 구간(포함) 밖은 제외된다.
// 두 핸들은 서로를 지나칠 수 없다(겹치는 건 허용 — 그러면 그 한 칸만 표시).
function RangeSlider({
  minIndex,
  maxIndex,
  steps,
  labels,
  minAriaLabel,
  maxAriaLabel,
  onChange,
  disabled = false,
  maxSelectableIndex,
  limitReason,
  disabledReason,
}: {
  minIndex: number
  maxIndex: number
  steps: number
  labels: string[]
  minAriaLabel: string
  maxAriaLabel: string
  onChange: (minIndex: number, maxIndex: number) => void
  disabled?: boolean
  // 눈금은 전부 보여주되, 실제로 이동할 수 있는 마지막 인덱스만 제한한다.
  maxSelectableIndex?: number
  limitReason?: ReactNode
  disabledReason?: ReactNode
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [limitHintVisible, setLimitHintVisible] = useState(false)
  const sliderSteps = Math.max(steps, 1)
  const selectableMaxIndex = Math.min(sliderSteps, maxSelectableIndex ?? sliderSteps)

  // 핸들 버튼은 순전히 시각적 표시일 뿐, 실제 클릭/드래그는 트랙 전체가 받는다 — 두 핸들이 겹치면
  // DOM상 나중에 그려지는 쪽(max)이 항상 클릭을 가로채 반대쪽 핸들을 못 잡는 문제를 이렇게 피한다.
  // 클릭 지점이 두 핸들의 중점보다 왼쪽이면 min을, 오른쪽이면 max를 그 위치로 옮긴다.
  //
  // 포인터가 실제로 움직였으면(threshold 이상) "드래그"로 보고 범위를 조정하고, 움직임 없이 그냥
  // 뗐으면("클릭") 가까운 핸들을 그 위치로 옮긴다. 기능 전체의 켜기/끄기는 별도 토글이 담당한다.
  const CLICK_MOVE_THRESHOLD = 4
  const startDrag = (e: React.PointerEvent) => {
    if (disabled) {
      if (disabledReason) setLimitHintVisible(true)
      return
    }
    e.preventDefault()
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const rawIndexFromClientX = (clientX: number) => {
      const inset = 8
      const usableWidth = Math.max(0, rect.width - inset * 2)
      const ratio = usableWidth > 0 ? Math.min(1, Math.max(0, (clientX - rect.left - inset) / usableWidth)) : 0
      return Math.round(ratio * sliderSteps)
    }
    const selectableIndexFromClientX = (clientX: number) => Math.min(rawIndexFromClientX(clientX), selectableMaxIndex)
    // 바깥쪽 뎁스는 현재 선택 가능한 상한에서 멈춘다.
    const dragIndexFromClientX = (clientX: number) => {
      const index = selectableIndexFromClientX(clientX)
      return Math.min(selectableMaxIndex, index)
    }
    const which: 'min' | 'max' = dragIndexFromClientX(e.clientX) <= (minIndex + maxIndex) / 2 ? 'min' : 'max'
    const startX = e.clientX
    let dragged = false
    const handleMove = (ev: PointerEvent) => {
      if (!dragged && Math.abs(ev.clientX - startX) < CLICK_MOVE_THRESHOLD) return
      dragged = true
      const index = dragIndexFromClientX(ev.clientX)
      if (which === 'min') onChange(Math.min(index, maxIndex), maxIndex)
      else onChange(minIndex, Math.max(index, minIndex))
    }
    const handleUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
      if (dragged) return
      // 움직이지 않고 뗐다 = 클릭. 가까운 핸들을 그 자리로 옮긴다.
      const index = dragIndexFromClientX(ev.clientX)
      if (which === 'min') onChange(Math.min(index, maxIndex), maxIndex)
      else onChange(minIndex, Math.max(index, minIndex))
    }
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
  }

  // 데이터가 얕아서 steps가 minIndex/maxIndex(기본값 등으로 미리 정해진 값)보다 작아질 수 있다 —
  // 그대로 두면 핸들이 트랙 밖(100% 너머)으로 밀려나므로 표시 위치만 안전하게 클램프한다.
  const minPct = (Math.min(minIndex, selectableMaxIndex) / sliderSteps) * 100
  const maxPct = (Math.min(maxIndex, selectableMaxIndex) / sliderSteps) * 100
  const blockedStartPct = ((selectableMaxIndex + 0.5) / sliderSteps) * 100
  const labelSteps = Math.max(labels.length - 1, 1)
  const visibleReason = disabled ? disabledReason : limitReason

  return (
    <div
      className="relative isolate"
      onPointerEnter={disabled && disabledReason ? () => setLimitHintVisible(true) : undefined}
      onPointerLeave={() => setLimitHintVisible(false)}
    >
      <div
        ref={trackRef}
        className={`relative h-4 w-full ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
        onPointerDown={startDrag}
      >
        <div className="absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 rounded bg-gray-600" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-[var(--accent)]"
          style={{ left: `calc(8px + ${minPct}% - ${minPct * 0.16}px)`, width: `calc(${maxPct - minPct}% - ${(maxPct - minPct) * 0.16}px)` }}
        />
        {/* 두 핸들이 같은 칸에 모이면 원 두 개가 겹쳐 화살표가 뭉개진다. 그때는 바깥으로 벌어지는
            화살표 둘을 담은 알약 하나로 그려서, 모여 있어도 양방향으로 벌릴 수 있는 핸들임이 보이게 한다. */}
        {minPct === maxPct ? (
          <div
            aria-label={`${minAriaLabel} / ${maxAriaLabel}`}
            className={`${RANGE_HANDLE_CLASS} z-10 w-7 justify-between px-1`}
            style={{ left: `calc(8px + ${minPct}% - ${minPct * 0.16}px)` }}
          >
            <ChevronGlyph direction="left" />
            <ChevronGlyph direction="right" />
          </div>
        ) : (
          <>
            <div aria-label={minAriaLabel} className={`${RANGE_HANDLE_CLASS} z-10 w-4`} style={{ left: `calc(8px + ${minPct}% - ${minPct * 0.16}px)` }}>
              <ChevronGlyph direction="left" />
            </div>
            <div aria-label={maxAriaLabel} className={`${RANGE_HANDLE_CLASS} z-20 w-4`} style={{ left: `calc(8px + ${maxPct}% - ${maxPct * 0.16}px)` }}>
              <ChevronGlyph direction="right" />
            </div>
          </>
        )}
        {!disabled && selectableMaxIndex < sliderSteps && (
          <div
            className="absolute inset-y-0 right-0 z-30 cursor-not-allowed"
            style={{ left: `calc(8px + ${blockedStartPct}% - ${blockedStartPct * 0.16}px)` }}
            onPointerEnter={() => setLimitHintVisible(true)}
            onPointerLeave={() => setLimitHintVisible(false)}
            onPointerDown={e => {
              e.stopPropagation()
              setLimitHintVisible(true)
            }}
          />
        )}
      </div>
      <div className={disabled ? 'opacity-40' : ''}>
        <SliderTickLabels
          labels={labels}
          steps={labelSteps}
          inset
          highlightedRange={[minIndex, maxIndex]}
          blockedFromIndex={disabled && disabledReason ? 0 : !disabled && selectableMaxIndex < sliderSteps ? selectableMaxIndex + 1 : undefined}
          onBlockedHintChange={setLimitHintVisible}
        />
      </div>
      {limitHintVisible && visibleReason && (disabled || selectableMaxIndex < sliderSteps) && (
        <div role="status" className={BLOCKED_HINT_CLASS}>
          {visibleReason}
        </div>
      )}
    </div>
  )
}

// 라벨 개수(=steps+1)가 슬라이더마다 다르므로, flex justify-between 대신 핸들과 똑같은 방식(각 tick의
// x% 위치에 절대 위치)으로 배치해야 라벨이 항상 그 tick과 x축이 맞는다 — 라벨 폭이 서로 달라도(예:
// "끄기" vs "중분류") 흔들리지 않는다. 양 끝만 가운데 정렬이 아니다. 가운데 정렬하면 라벨 절반이
// 트랙 밖으로 나가서 끝 핸들과 어긋나 보이므로, 첫 라벨은 왼쪽 끝을, 마지막 라벨은 오른쪽 끝을 핸들에
// 맞춘다.
function SliderTickLabels({
  labels,
  steps,
  inset = false,
  highlightedIndex,
  highlightedRange,
  blockedFromIndex,
  onBlockedHintChange,
}: {
  labels: string[]
  steps: number
  inset?: boolean
  highlightedIndex?: number
  highlightedRange?: [number, number]
  blockedFromIndex?: number
  onBlockedHintChange?: (visible: boolean) => void
}) {
  const lastIndex = labels.length - 1
  return (
    <div className={`relative mt-1 h-4 text-xs text-gray-400 ${inset ? 'mx-2' : ''}`}>
      {labels.map((label, index) => {
        const blocked = blockedFromIndex !== undefined && index >= blockedFromIndex
        const highlighted = highlightedIndex === index || (
          highlightedRange !== undefined && index >= highlightedRange[0] && index <= highlightedRange[1]
        )
        return (
          <span
            key={index}
            className={`absolute whitespace-nowrap ${blocked ? 'cursor-not-allowed text-gray-600' : highlighted ? 'font-medium text-white' : 'text-gray-400'} ${
              index === 0 ? '' : index === lastIndex ? '-translate-x-full' : '-translate-x-1/2'
            }`}
            style={{ left: `${(index / steps) * 100}%` }}
            onPointerEnter={blocked ? () => onBlockedHintChange?.(true) : undefined}
            onPointerLeave={blocked ? () => onBlockedHintChange?.(false) : undefined}
            onPointerDown={blocked ? () => onBlockedHintChange?.(true) : undefined}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}

// 핸들 하나로 딱 하나의 칸만 고르는 슬라이더 — RangeSlider와 달리 범위가 아니라 단일 값(예: 종목
// 박스 표시 내용)을 고를 때 쓴다. 눈금 라벨 배치 방식은 RangeSlider와 동일(라벨 폭과 무관하게 위치 고정).
function SingleValueSlider({
  index,
  labels,
  ariaLabel,
  onChange,
  disabled = false,
}: {
  index: number
  labels: string[]
  ariaLabel: string
  onChange: (index: number) => void
  disabled?: boolean
}) {
  const steps = Math.max(labels.length - 1, 1)
  return (
    <div>
      <input
        type="range"
        min={0}
        max={steps}
        step={1}
        value={index}
        aria-label={ariaLabel}
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        className="block w-full accent-[var(--accent)] disabled:cursor-not-allowed"
      />
      <SliderTickLabels labels={labels} steps={steps} inset highlightedIndex={index} />
    </div>
  )
}

// 아래 섹션 컴포넌트들은 전부 페이지가 SettingsSidebar의 children으로 직접 골라서 조립한다 — 페이지마다
// 유효한 옵션이 다 다른데(지도는 전부 유효, 섹터는 일부만, 요약/어드민은 전혀 없음), 옵션 하나를 켜고
// 끄는 스위치 하나로는 이 조합을 감당할 수 없기 때문. 새 페이지 전용 옵션이 생기면 그 페이지 파일에
// 새 섹션 컴포넌트를 하나 추가해서 끼워 넣기만 하면 되고, 여기 다른 섹션이나 SettingsSidebar 껍데기
// 자체는 안 건드려도 된다.

// 그룹 페이지 등락률 평균 방식 — 시총 가중/동일 가중 중 하나를 고른다.
export function SettingsAverageModeSection({
  avgChangeRateUseSimple,
  onChange,
}: {
  avgChangeRateUseSimple: boolean
  onChange: (useSimple: boolean) => void
}) {
  const options = [
    { value: false, label: '시총 가중' },
    { value: true, label: '동일 가중' },
  ]
  return (
    <div className="text-sm">
      <span className="flex max-w-[16rem] items-center text-left text-[15px] text-white">
        <span className="settings-section-num">등락률 평균</span>
        <SettingHelpIcon label="등락률 평균" description="업종 등락률 계산에 적용할 평균 방식을 선택합니다." />
      </span>
      <div role="radiogroup" aria-label="등락률 평균" className="mt-2 grid max-w-[16rem] grid-cols-2 rounded-md border border-gray-600 bg-zinc-700 p-0.5">
        {options.map(option => {
          const selected = avgChangeRateUseSimple === option.value
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`min-h-9 rounded px-1 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                selected ? 'bg-[var(--accent)] text-black' : 'border-0 bg-transparent text-gray-300 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// 그룹 페이지 "N분 전 대비"의 비교 시점 — 15/30/45/60분 중 하나를 슬라이더로 고른다.
const BEFORE_MINUTES_OPTIONS = [15, 30, 45, 60]

export function SettingsBeforeMinutesSection({
  beforeMinutes,
  onChange,
}: {
  beforeMinutes: number
  onChange: (minutes: number) => void
}) {
  // URL 파라미터로 옵션에 없는 값(예: 10)이 들어와도 슬라이더는 가장 가까운 칸을 가리킨다.
  const index = BEFORE_MINUTES_OPTIONS.reduce(
    (best, minutes, i) =>
      Math.abs(minutes - beforeMinutes) < Math.abs(BEFORE_MINUTES_OPTIONS[best] - beforeMinutes) ? i : best,
    0,
  )
  return (
    <div className="mt-[49px] text-sm">
      <span className="flex max-w-[16rem] items-center text-left text-[15px] text-white">
        <span className="settings-section-num">비교 시점</span>
        <SettingHelpIcon label="비교 시점" description="현재 등락률을 몇 분 전과 비교해 변화폭을 산출합니다." />
      </span>
      <div className="mt-2 max-w-[16rem]">
        <SingleValueSlider
          index={index}
          labels={BEFORE_MINUTES_OPTIONS.map(minutes => `${minutes}분`)}
          ariaLabel="비교 시점(분 전)"
          onChange={i => onChange(BEFORE_MINUTES_OPTIONS[i])}
        />
      </div>
    </div>
  )
}

export function SettingsCustomModeSection({
  isCustom,
  onToggleCustom,
  stockCountLabel,
  avgChangeRateUseSimple,
  onToggleAvgChangeRateUseSimple,
  showEqualWeightToggle = false,
}: {
  isCustom: boolean
  onToggleCustom: () => void
  // 커스텀 모드 토글 옆에 표시할 종목 수("N/N종목") — 지도 페이지에서만 넘겨준다.
  stockCountLabel?: string
  avgChangeRateUseSimple: boolean
  onToggleAvgChangeRateUseSimple: () => void
  // true면 "동일 가중" 토글을 이 스티키 블록 안(구분선 위)에 커스텀 모드 바로 아래 줄로 같이 그린다
  // — 지도 페이지 전용(섹터 페이지는 아직 SettingsEqualWeightSection을 별도로 그대로 쓴다, 나중에
  // 똑같이 정리 예정). 기본 false라 이 prop을 안 넘기는 호출부는 기존과 동일하게 동작한다.
  showEqualWeightToggle?: boolean
}) {
  return (
    <div className="sticky top-0 z-10 -mx-4 bg-zinc-800 px-4 pt-4 pb-3">
      <ToggleSwitch
        checked={isCustom}
        onChange={onToggleCustom}
        label="커스텀 모드"
        labelClassName="text-base settings-section-bullet"
        labelSuffix={
          <>
            <SettingHelpIcon label="커스텀 모드" description="내가 구성한 업종 분류를 지도에 적용합니다." />
            {stockCountLabel && <span className="text-sm text-gray-400">{stockCountLabel}</span>}
          </>
        }
      />
      {showEqualWeightToggle && (
        <div className="mt-3">
          <EqualWeightToggleSwitch
            avgChangeRateUseSimple={avgChangeRateUseSimple}
            onToggleAvgChangeRateUseSimple={onToggleAvgChangeRateUseSimple}
          />
        </div>
      )}
    </div>
  )
}

// 스위치(원래 방식)는 그대로 두고, 라벨만 "지금 켜진 쪽"을 앞(흰색·번호 포함)에, "꺼진 쪽"을 뒤(회색)에
// 붙여서 둘 다 보여준다 — 클릭 대상은 여전히 스위치 하나뿐이고 라벨은 상태 표시 전용이다.
function EqualWeightToggleSwitch({
  avgChangeRateUseSimple,
  onToggleAvgChangeRateUseSimple,
}: {
  avgChangeRateUseSimple: boolean
  onToggleAvgChangeRateUseSimple: () => void
}) {
  return (
    <ToggleSwitch
      checked={avgChangeRateUseSimple}
      onChange={onToggleAvgChangeRateUseSimple}
      label={avgChangeRateUseSimple ? '동일 가중' : '시총 가중'}
      labelClassName="text-base settings-section-bullet"
      labelSuffix={
        <>
          <span className="text-gray-500">↔ {avgChangeRateUseSimple ? '시총 가중' : '동일 가중'}</span>
          <SettingHelpIcon label="등락률 평균" description="업종 등락률을 시가총액 가중 또는 동일 가중으로 계산합니다." />
        </>
      }
      forceLabelWhite
    />
  )
}

export function SettingsEqualWeightSection({
  avgChangeRateUseSimple,
  onToggleAvgChangeRateUseSimple,
}: {
  avgChangeRateUseSimple: boolean
  onToggleAvgChangeRateUseSimple: () => void
}) {
  return (
    <div className="pt-4 text-white">
      <EqualWeightToggleSwitch
        avgChangeRateUseSimple={avgChangeRateUseSimple}
        onToggleAvgChangeRateUseSimple={onToggleAvgChangeRateUseSimple}
      />
    </div>
  )
}

function SettingsClassificationSelector({
  heatmap,
  onSelectHeatmap,
  atBottom = false,
  snapshotTime,
}: {
  heatmap: HeatmapKey
  onSelectHeatmap: (heatmap: HeatmapKey) => void
  atBottom?: boolean
  snapshotTime?: string | null
}) {
  // key가 null인 항목(내 히트맵)은 아직 고를 수 없다.
  const options: { key: HeatmapKey | null; label: string }[] = [
    { key: null, label: HEATMAP_NAMES.mine.tab },
    { key: 'krx', label: HEATMAP_NAMES.krx.tab },
    { key: 'nxt', label: HEATMAP_NAMES.nxt.tab },
    { key: 'marketry', label: HEATMAP_NAMES.marketry.tab },
  ]

  return (
    <div className={`${atBottom ? 'shrink-0 px-4 py-3' : 'mb-6 pt-5 pb-6'} text-white`}>
      <p className="flex items-center text-base">
        히트맵 선택
      </p>
      <div role="radiogroup" aria-label="히트맵 선택" className="mt-2 grid grid-cols-4 rounded-md border border-gray-600 bg-zinc-700 p-0.5">
        {options.map(option => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={option.key !== null && heatmap === option.key}
            onClick={() => option.key !== null && heatmap !== option.key && onSelectHeatmap(option.key)}
            disabled={option.key === null}
            title={option.key === null ? '준비 중' : undefined}
            className={`min-h-8 rounded px-0.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              option.key === null
                ? 'cursor-not-allowed border-0 bg-transparent text-gray-500'
                : heatmap === option.key
                  ? 'bg-[var(--accent)] text-black'
                  : 'border-0 bg-transparent text-gray-300 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {atBottom && snapshotTime && (
        <p className={`${FONT_BAR_TIME} mt-2 flex items-center gap-1.5 whitespace-nowrap text-xs text-gray-400`}>
          <span className="flex items-center">
            마지막 업데이트
            <SettingHelpIcon label="마지막 업데이트" description="운영자가 종목 분류를 마지막으로 변경한 시각입니다." />
          </span>
          <span>{toMarketMapSnapshotDateLabel(snapshotTime)}</span>
          <span>{toMarketMapSnapshotTimeOnlyLabel(snapshotTime)}</span>
        </p>
      )}
    </div>
  )
}

function SettingsAverageModeSelector({
  avgChangeRateUseSimple,
  onToggleAvgChangeRateUseSimple,
}: {
  avgChangeRateUseSimple: boolean
  onToggleAvgChangeRateUseSimple: () => void
}) {
  const options = [
    { value: false, label: '시총 가중' },
    { value: true, label: '동일 가중' },
  ]

  return (
    <div className="settings-first-stock-size mb-6 pt-5 pb-6 text-white">
      <p className="flex items-center text-[15px]">
        <span className="settings-section-num">등락률 평균</span>
        <SettingHelpIcon label="등락률 평균" description="업종 등락률 계산에 적용할 평균 방식을 선택합니다." />
      </p>
      <div role="radiogroup" aria-label="등락률 평균" className="mt-3 grid grid-cols-2 rounded-md border border-gray-600 bg-zinc-700 p-0.5">
        {options.map(option => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={avgChangeRateUseSimple === option.value}
            onClick={() => avgChangeRateUseSimple !== option.value && onToggleAvgChangeRateUseSimple()}
            className={`min-h-8 rounded px-1 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              avgChangeRateUseSimple === option.value
                ? 'bg-[var(--accent)] text-black'
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

export function SettingsStockSizeSelector({
  marketCapRatio,
  onChangeMarketCapRatio,
}: {
  marketCapRatio: number
  onChangeMarketCapRatio: (value: number) => void
}) {
  const bookmark = useContext(SettingsBookmarkContext)
  if (bookmark.mode === 'bookmark' && !bookmark.ids.includes('boxSize')) return null
  return (
    <div className={`settings-first-stock-size text-white ${bookmark.mode === 'bookmark' ? bookmarkItemClass(bookmark, 'boxSize') : 'mb-6 pt-5 pb-6'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <SettingTitle bookmarkId="boxSize" help className="text-[15px]">박스 크기</SettingTitle>
          <SettingHelpIcon bookmarkId="boxSize" label="박스 크기" description="박스 면적 = 시가총액^(비율 ÷ 100)으로 계산합니다. 0%는 모든 종목을 같은 크기로, 50%는 시가총액의 제곱근 비율로, 100%는 시가총액 비례로 표시합니다." />
        </div>
        <span className="text-sm text-gray-400">{marketCapRatio}%</span>
      </div>
      <SettingDescription>시가총액이 박스 크기에 반영되는 정도</SettingDescription>
      <div className="mt-[18px]">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={marketCapRatio}
          aria-label="박스 크기 시가총액 비율"
          aria-valuetext={`${marketCapRatio}%`}
          onChange={e => onChangeMarketCapRatio(Number(e.target.value))}
          className="block w-full accent-[var(--accent)]"
        />
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>동일 크기</span>
          <span>시가총액 비례</span>
        </div>
      </div>
    </div>
  )
}

export function SettingsSectorLevelSection({
  maxDepth,
  sectorLevelEnabled,
  onToggleSectorLevel,
  availableMaxDepth,
  onChangeMaxDepth,
  activeDepthMetric,
  onChangeActiveDepthMetric,
  depthMetricEnabled,
  onToggleDepthMetric,
  depthMetricMinIndex,
  depthMetricMaxIndex,
  onChangeDepthMetricRange,
  topPickDepth,
  topPickCount,
  topPickEnabled,
  onToggleTopPick,
  topPickMaxSelectableDepth,
  onChangeTopPickDepth,
  onChangeTopPickCount,
  stockLabelModeIndex,
  stockLabelEnabled,
  onToggleStockLabel,
  onChangeStockLabelModeIndex,
  boxLabelMinAreaPercent,
  onChangeBoxLabelMinAreaPercent,
  decimalPlacesIndex,
  onChangeDecimalPlacesIndex,
  stockPopupOnHover,
  onChangeStockPopupOnHover,
  showTopPick = false,
  showDecimalPlaces = false,
  showDivider = false,
  showClassification = true,
  showStockDisplay = true,
}: {
  // "업종 표시 탭" 위에 구분선(border-t)을 그릴지 — 스티키 커스텀모드 블록(또는 동일 가중) 바로 다음에
  // 올 때는 그 자체로 이미 구분되므로 false로 끈다. "종목 박스"는 "업종 표시 탭" 바로 다음이라 항상 그린다.
  showDivider?: boolean
  // null이면 제한 없음(=availableMaxDepth 전체 다 보여줌). 슬라이더가 다룰 수 있는 실제 상한은
  // 지금 트리(exclude/tier 필터링까지 반영된)의 최대 뎁스라 따로 내려받는다.
  maxDepth: number | null
  sectorLevelEnabled: boolean
  onToggleSectorLevel: () => void
  availableMaxDepth: number
  onChangeMaxDepth: (value: number) => void
  // 그룹 탭에 표시할 네 항목 중 하나만 고른다.
  activeDepthMetric: DepthMetric
  onChangeActiveDepthMetric: (metric: DepthMetric) => void
  // 그룹 탭 표시 항목 전체의 표시 여부.
  depthMetricEnabled: boolean
  onToggleDepthMetric: () => void
  // 인덱스는 뎁스에 직접 대응(0=대분류, 1=중분류, ...) — 선택한 모든 항목에 공통으로 적용된다.
  depthMetricMinIndex: number
  depthMetricMaxIndex: number
  onChangeDepthMetricRange: (minIndex: number, maxIndex: number) => void
  // 선호 업종의 절대 depth/상위 N개 — 지도 페이지에서만 showTopPick으로 노출한다.
  topPickDepth: number
  topPickCount: number
  topPickEnabled: boolean
  onToggleTopPick: () => void
  topPickMaxSelectableDepth: number
  onChangeTopPickDepth: (depth: number) => void
  onChangeTopPickCount: (count: number) => void
  // 종목 박스에 이름만(1)/등락률만(2)/둘 다(3) 보여줄지. 표시 여부는 별도 토글로 제어한다.
  stockLabelModeIndex: number
  stockLabelEnabled: boolean
  onToggleStockLabel: () => void
  onChangeStockLabelModeIndex: (index: number) => void
  // 종목 박스가 전체 트리맵 넓이에서 이 비중(%) 미만이면 종목명/등락률을 표시하지 않는다.
  boxLabelMinAreaPercent: number
  onChangeBoxLabelMinAreaPercent: (value: number) => void
  // 등락률(%) 표시 소수점 자릿수(0=정수, 1=소수 1자리, 2=소수 2자리).
  decimalPlacesIndex: number
  onChangeDecimalPlacesIndex: (index: number) => void
  // 종목 정보 팝업을 우클릭(false)으로 띄울지, 커서를 박스 위로 옮길 때(true) 띄울지.
  stockPopupOnHover: boolean
  onChangeStockPopupOnHover: (onHover: boolean) => void
  // true면 지도 페이지에만 선호 업종 설정을 추가한다.
  showTopPick?: boolean
  // true면 "종목 박스" 그룹에 "등락률 소수점" 슬라이더를 같이 그린다 — 지도 페이지에서 실제로 트리맵
  // 등락률(%) 표시에 쓰이는 설정이라 지도 페이지에서만 켠다(섹터는 그래프 자체 소수점 포맷을 따로
  // 쓰므로 기본 false로 숨긴다).
  showDecimalPlaces?: boolean
  // 업종 설정과 종목 박스 표기를 서로 다른 사이드바 탭에서 보여줄 수 있다.
  showClassification?: boolean
  showStockDisplay?: boolean
}) {
  // 설정에서 선택할 수 있는 최소 단계는 대/중/소분류까지 보장한다. 실제 데이터가 얕으면 해당 단계의
  // 화면 결과만 비어 있을 뿐, 사용자가 미리 설정해 둔 값을 UI가 임의로 막거나 지우지는 않는다.
  const depthLabelCount = Math.max(availableMaxDepth, DEPTH_LABELS.length)
  const depthValue = Math.min(maxDepth ?? depthLabelCount, depthLabelCount)
  const depthMetricMaxSelectableIndex = Math.max(0, Math.min(depthLabelCount, maxDepth ?? depthLabelCount) - 1)
  const isDepthMetricDisabled = !sectorLevelEnabled
  const isTopPickDisabled = !sectorLevelEnabled
  const depthMetricLabels = Array.from({ length: depthLabelCount }, (_, index) => DEPTH_LABELS[index] ?? `${index + 1}차 분류`)
  // 레벨 값은 1=대분류, 2=중분류, 3=소분류. 슬라이더 인덱스와 1만큼 차이 난다.
  const depthMetricSliderSteps = Math.max(depthLabelCount - 1, 1)
  // 선택값은 저장한 범위를 그대로 유지하되, 현재 업종 단계를 넘는 부분만 화면에서 잘라 보여준다.
  const depthMetricSliderMinIndex = Math.min(depthMetricMinIndex, depthMetricMaxSelectableIndex)
  const depthMetricSliderMaxIndex = Math.min(depthMetricMaxIndex, depthMetricMaxSelectableIndex)
  const isDepthMetricRangeDisabled = isDepthMetricDisabled || !depthMetricEnabled
  const [depthMetricSectionHintVisible, setDepthMetricSectionHintVisible] = useState(false)
  const [topPickSectionHintVisible, setTopPickSectionHintVisible] = useState(false)
  const [textThresholdHintVisible, setTextThresholdHintVisible] = useState(false)
  const bookmark = useContext(SettingsBookmarkContext)
  const inBookmarkTab = bookmark.mode === 'bookmark'
  const hideItem = (id: SettingsBookmarkId) => inBookmarkTab && !bookmark.ids.includes(id)
  const itemClass = (id: SettingsBookmarkId) => bookmarkItemClass(bookmark, id)
  const bookmarkableIds: SettingsBookmarkId[] = [
    ...(showClassification ? (['depthLevel', 'depthMetric', 'depthRange'] as const) : []),
    ...(showClassification && showTopPick ? (['topPick'] as const) : []),
    ...(showStockDisplay ? (['boxLabel', 'textThreshold'] as const) : []),
    ...(showStockDisplay && showDecimalPlaces ? (['decimalPlaces'] as const) : []),
  ]
  if (inBookmarkTab && bookmarkableIds.every(hideItem)) return null
  const depthMetricRangeDisabledReason = !sectorLevelEnabled
    ? <><span className="inline-block whitespace-nowrap border-b border-current">1-1) 업종 표시 단계</span>를 켜야 선택이 가능합니다.</>
    : !depthMetricEnabled
      ? <><span className="inline-block whitespace-nowrap border-b border-current">1-2) 표시 지표</span>를 켜야 선택이 가능합니다.</>
      : null

  return (
    <div className="text-white">
      {showClassification && <div className={showDivider ? 'mt-6 pt-8' : inBookmarkTab ? '' : 'pt-5'}>
        <div>
          <div className={`settings-first-depth-level text-sm ${itemClass('depthLevel')}`}>
            <div className="flex max-w-[16rem] items-center justify-between">
              <span className="flex items-center text-left text-white">
                <SettingTitle bookmarkId="depthLevel" className="text-[15px]">업종 표시 단계</SettingTitle>
              </span>
              <ToggleSwitch
                checked={sectorLevelEnabled}
                onChange={onToggleSectorLevel}
                label="업종 표시 단계 사용"
                hideLabel
                compact
              />
            </div>
            <SettingDescription>지도에 표시할 업종 분류의 깊이</SettingDescription>
            <div className={`mt-[18px] max-w-[16rem] ${sectorLevelEnabled ? '' : 'opacity-40'}`}>
              <SingleValueSlider
                index={depthValue - 1}
                labels={depthMetricLabels}
                ariaLabel="업종 표시 단계"
                onChange={index => onChangeMaxDepth(index + 1)}
                disabled={!sectorLevelEnabled}
              />
            </div>
          </div>
          <div className={`settings-second-depth-metric relative text-sm ${inBookmarkTab ? '' : 'mt-6'} ${itemClass('depthMetric')}`}>
            <div className={isDepthMetricDisabled ? 'opacity-40' : ''}>
              <div className="flex max-w-[16rem] items-center justify-between">
                <span className="flex items-center text-left text-white">
                  <SettingTitle bookmarkId="depthMetric" className="text-[15px]">표시 지표</SettingTitle>
                </span>
                <ToggleSwitch
                  checked={depthMetricEnabled}
                  onChange={onToggleDepthMetric}
                  label="표시 지표 사용"
                  hideLabel
                  compact
                  disabled={isDepthMetricDisabled}
                />
              </div>
              <SettingDescription>업종 항목에 표시할 지표</SettingDescription>
              <div role="radiogroup" aria-label="표시 지표" className={`mt-[18px] grid max-w-[16rem] grid-cols-4 rounded-md border border-gray-600 bg-zinc-700 p-0.5 ${depthMetricEnabled ? '' : 'opacity-40'}`}>
                {GROUP_TAB_METRIC_OPTIONS.map(option => (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={activeDepthMetric === option.key}
                    onClick={() => onChangeActiveDepthMetric(option.key)}
                    disabled={isDepthMetricDisabled || !depthMetricEnabled}
                    className={`min-h-7 rounded px-0.5 py-1 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed ${
                      activeDepthMetric === option.key
                        ? 'bg-[var(--accent)] text-black'
                        : 'border-0 bg-transparent text-gray-300 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {isDepthMetricDisabled && (
              <div
                className="absolute inset-0 z-10 cursor-not-allowed"
                onPointerEnter={() => setDepthMetricSectionHintVisible(true)}
                onPointerLeave={() => setDepthMetricSectionHintVisible(false)}
                onPointerDown={e => {
                  e.preventDefault()
                  setDepthMetricSectionHintVisible(true)
                }}
              />
            )}
            {isDepthMetricDisabled && depthMetricSectionHintVisible && (
              <div role="status" className={BLOCKED_HINT_CLASS}>
                <span className="inline-block whitespace-nowrap border-b border-current">1-1) 업종 표시 단계</span>를 켜야 선택이 가능합니다.
              </div>
            )}
          </div>
          <div
            aria-disabled={isDepthMetricRangeDisabled}
            className={`settings-third-depth-range text-sm ${inBookmarkTab ? '' : 'mt-6'} ${itemClass('depthRange')} ${isDepthMetricRangeDisabled ? 'cursor-not-allowed' : ''}`}
          >
            <span className={`flex items-center text-left text-[15px] text-white ${isDepthMetricRangeDisabled ? 'opacity-40' : ''}`}>
              <SettingTitle bookmarkId="depthRange">표시 위치</SettingTitle>
            </span>
            <div className={isDepthMetricRangeDisabled ? 'opacity-40' : ''}>
              <SettingDescription>지표를 나타낼 업종 단계</SettingDescription>
            </div>
            <div className="mt-[18px] max-w-[16rem]">
              <RangeSlider
                minIndex={depthMetricSliderMinIndex}
                maxIndex={depthMetricSliderMaxIndex}
                steps={depthMetricSliderSteps}
                labels={depthMetricLabels}
                minAriaLabel="최소 표시 뎁스"
                maxAriaLabel="최대 표시 뎁스"
                maxSelectableIndex={depthMetricMaxSelectableIndex}
                limitReason={<><span className="inline-block whitespace-nowrap border-b border-current">1-1) 업종 표시 단계</span>를 높여야 선택이 가능합니다.</>}
                disabledReason={depthMetricRangeDisabledReason}
                onChange={onChangeDepthMetricRange}
                disabled={isDepthMetricRangeDisabled}
              />
            </div>
          </div>
          {showTopPick && (
            <div className={`settings-fourth-top-pick relative text-sm ${inBookmarkTab ? '' : 'mt-6'} ${itemClass('topPick')}`}>
              <div className={isTopPickDisabled ? 'opacity-40' : ''}>
                <div className="flex max-w-[16rem] items-center justify-between">
                  <span className="flex items-center text-left text-white">
                    <SettingTitle bookmarkId="topPick" help className="text-[15px]">강세 표시</SettingTitle>
                    <SettingHelpIcon
                      bookmarkId="topPick"
                      label="강세 표시"
                      description={<>시총 가중 등락률을 기준으로 합니다.<br />ETF 등락률을 추종하고자 하였습니다.<br /><br /><span className="inline-block whitespace-nowrap border-b border-current">1-2) 표시 지표</span>에서 동일 가중을 선택한 경우는 예외로 합니다.</>}
                    />
                  </span>
                  <ToggleSwitch
                    checked={topPickEnabled}
                    onChange={onToggleTopPick}
                    label="강세 표시 사용"
                    hideLabel
                    compact
                    disabled={isTopPickDisabled}
                  />
                </div>
                <SettingDescription>등락률이 높은 업종을 강조</SettingDescription>
                <div className="mt-1 flex max-w-[16rem] justify-end">
                  <DepthSelect
                    depth={topPickDepth}
                    onChange={onChangeTopPickDepth}
                    maxSelectableDepth={topPickMaxSelectableDepth}
                    ariaLabel="강세 표시 업종 단계"
                    disabled={isTopPickDisabled || !topPickEnabled}
                  />
                </div>
                <div className={`mt-2 max-w-[16rem] ${topPickEnabled ? '' : 'opacity-40'}`}>
                  <SingleValueSlider
                    index={topPickCount - 1}
                    labels={TOP_PICK_COUNT_LABELS}
                    ariaLabel="강세 표시 개수"
                    onChange={index => onChangeTopPickCount(index + 1)}
                    disabled={isTopPickDisabled || !topPickEnabled}
                  />
                </div>
              </div>
              {isTopPickDisabled && (
                <div
                  className="absolute inset-0 z-10 cursor-not-allowed"
                  onPointerEnter={() => setTopPickSectionHintVisible(true)}
                  onPointerLeave={() => setTopPickSectionHintVisible(false)}
                  onPointerDown={e => {
                    e.preventDefault()
                    setTopPickSectionHintVisible(true)
                  }}
                />
              )}
              {isTopPickDisabled && topPickSectionHintVisible && (
                <div role="status" className={BLOCKED_HINT_CLASS}>
                <span className="inline-block whitespace-nowrap border-b border-current">1-1) 업종 표시 단계</span>를 켜야 선택이 가능합니다.
                </div>
              )}
            </div>
          )}
        </div>
      </div>}
      {/* 종목 박스 탭의 박스 크기 다음에 종목 표기, 텍스트 표시 기준, 등락률 소수점을
          같은 번호 위계로 이어서 표시한다. */}
      {showStockDisplay && <div className={showClassification ? 'mt-6 pt-8' : 'pt-0'}>
        <div>
          <div className={`settings-second-stock-label text-sm ${inBookmarkTab ? '' : 'mt-2'} ${itemClass('boxLabel')}`}>
            <div className="flex max-w-[16rem] items-center justify-between">
              <span className="flex items-center text-left text-white">
                <SettingTitle bookmarkId="boxLabel" className="text-[15px]">박스 내 표기</SettingTitle>
              </span>
              <ToggleSwitch
                checked={stockLabelEnabled}
                onChange={onToggleStockLabel}
                label="박스 내 표기 사용"
                hideLabel
                compact
              />
            </div>
            <SettingDescription>박스 안에 표시할 내용</SettingDescription>
            <div
              role="radiogroup"
              aria-label="박스 내 표기"
              className={`mt-[18px] grid max-w-[16rem] grid-cols-3 rounded-md border border-gray-600 bg-zinc-700 p-0.5 ${stockLabelEnabled ? '' : 'opacity-40'}`}
            >
              {STOCK_LABEL_MODE_LABELS.map((label, index) => {
                const value = index + 1
                const selected = stockLabelModeIndex === value
                return (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!stockLabelEnabled}
                    onClick={() => onChangeStockLabelModeIndex(value)}
                    className={`min-h-9 rounded px-1 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                      selected
                        ? 'bg-[var(--accent)] text-black'
                        : 'border-0 bg-transparent text-gray-300 hover:text-white'
                    }`}
                  >
                    {label === '모두' ? (
                      <span className="flex flex-col items-center leading-[1.1]">
                        <span>종목명</span>
                        <span>등락률</span>
                      </span>
                    ) : label}
                  </button>
                )
              })}
            </div>
          </div>
          <div
            className={`settings-third-text-threshold relative text-sm ${inBookmarkTab ? '' : 'mt-6'} ${itemClass('textThreshold')} ${stockLabelEnabled ? '' : 'cursor-not-allowed'}`}
            onPointerEnter={!stockLabelEnabled ? () => setTextThresholdHintVisible(true) : undefined}
            onPointerLeave={() => setTextThresholdHintVisible(false)}
            onPointerDown={!stockLabelEnabled ? e => {
              e.preventDefault()
              setTextThresholdHintVisible(true)
            } : undefined}
          >
            {/* 퍼센티지 값은 우측 끝에 옅은 회색으로 — 그 값이 없다고 치면 라벨만 가운데 정렬된 것처럼
                보이도록, 라벨을 flex-1로 남는 공간에서 가운데 정렬한다("업종 단계" + N/M 배지와
                동일한 패턴). 값 변경은 아래 슬라이더로만 한다. */}
            <div className="flex max-w-[16rem] items-center justify-between">
              <span className="flex items-center text-left text-[15px] text-white">
                <SettingTitle bookmarkId="textThreshold" help>텍스트 표시 기준</SettingTitle>
                <SettingHelpIcon
                  bookmarkId="textThreshold"
                  label="텍스트 표시 기준"
                  description="기준 퍼센트는 지도 전체 면적 대비 종목 박스 면적입니다."
                />
              </span>
              <span className="text-gray-400">{boxLabelMinAreaPercent.toFixed(2)}%</span>
            </div>
            <SettingDescription>작은 박스의 글자를 숨기는 기준</SettingDescription>
            <div className={`mt-[18px] max-w-[16rem] ${stockLabelEnabled ? '' : 'opacity-40'}`}>
              <input
                type="range"
                min={0.01}
                max={0.3}
                step={0.01}
                value={boxLabelMinAreaPercent}
                onChange={e => onChangeBoxLabelMinAreaPercent(Number(e.target.value))}
                disabled={!stockLabelEnabled}
                className="block w-full accent-[var(--accent)] disabled:cursor-not-allowed"
              />
            </div>
            {!stockLabelEnabled && textThresholdHintVisible && (
              <div role="status" className={BLOCKED_HINT_CLASS}>
                <span className="inline-block whitespace-nowrap border-b border-current">3-2) 박스 내 표기</span>를 켜야 선택이 가능합니다.
              </div>
            )}
          </div>
          {showDecimalPlaces && (
            <div className={`settings-fourth-decimal-places text-sm ${inBookmarkTab ? '' : 'mt-6'} ${itemClass('decimalPlaces')}`}>
              <span className="flex max-w-[16rem] items-center text-left text-[15px] text-white">
                <SettingTitle bookmarkId="decimalPlaces">등락률 소수점</SettingTitle>
              </span>
              <SettingDescription>종목 등락률의 소수점 자릿수</SettingDescription>
              <div className="mt-[18px] max-w-[16rem]">
                <SingleValueSlider
                  index={decimalPlacesIndex}
                  labels={DECIMAL_PLACES_LABELS}
                  ariaLabel="등락률 소수점 자릿수"
                  onChange={onChangeDecimalPlacesIndex}
                />
              </div>
            </div>
          )}
          {showDecimalPlaces && !inBookmarkTab && (
            <div className="settings-fifth-stock-popup mt-6 text-sm">
              <span className="flex max-w-[16rem] items-center text-left text-[15px] text-white">
                <span className="settings-section-num">종목 정보</span>
              </span>
              <SettingDescription>종목 정보를 여는 방식</SettingDescription>
              <div
                role="radiogroup"
                aria-label="종목 정보 여는 방식"
                className="mt-[18px] grid max-w-[16rem] grid-cols-2 rounded-md border border-gray-600 bg-zinc-700 p-0.5"
              >
                {[
                  { label: '우클릭', onHover: false },
                  { label: '커서 이동', onHover: true },
                ].map(option => {
                  const selected = stockPopupOnHover === option.onHover
                  return (
                    <button
                      key={option.label}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChangeStockPopupOnHover(option.onHover)}
                      className={`min-h-7 rounded px-1 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? 'bg-[var(--accent)] text-black'
                          : 'border-0 bg-transparent text-gray-300 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>}
    </div>
  )
}

export function SettingsMarketValueSection({
  tiers,
  tierRangeMinIndex,
  tierRangeMaxIndex,
  onChangeTierRange,
  showDivider = true,
}: {
  isCustom: boolean
  // 오름차순(소→초) 정렬된 시가총액 구간 정의 — GET /map/value-tiers 조회 결과(useMarketValueTiers).
  // 아직 로딩 전이면 빈 배열.
  tiers: MarketValueTierItem[]
  // tiers 배열 기준 인덱스. 이 구간(포함) 밖의 시가총액 등급은 마켓맵에서 제외된다.
  tierRangeMinIndex: number
  tierRangeMaxIndex: number
  onChangeTierRange: (minIndex: number, maxIndex: number) => void
  // 위에 구분선(border-t)을 그릴지 — 스티키 커스텀모드 블록 바로 다음에 올 때(지도 페이지)는
  // false로 꺼서 이중 구분선을 피한다.
  showDivider?: boolean
}) {
  // tiers/tierRangeMinIndex·MaxIndex는 오름차순(소형주→초대형주) 기준을 그대로 유지하고, 화면에
  // 그릴 때만 좌우를 뒤집는다(초대형주가 왼쪽) — 저장값/다른 화면(섹터 랭킹)과 공유하는 인덱스
  // 의미는 안 바뀐다.
  const bookmark = useContext(SettingsBookmarkContext)
  if (bookmark.mode === 'bookmark' && !bookmark.ids.includes('marketValueRange')) return null
  const itemClass = bookmarkItemClass(bookmark, 'marketValueRange')
  const tierSteps = Math.max(tiers.length - 1, 1)
  const tierDisplayLabels = [...tiers].reverse().map(tier => tier.label)
  const tierDisplayMinIndex = tierSteps - tierRangeMaxIndex
  const tierDisplayMaxIndex = tierSteps - tierRangeMinIndex

  return (
    <div className={`settings-market-value text-white ${itemClass} ${bookmark.mode === 'bookmark' ? '' : showDivider ? 'mt-6 pt-8' : 'pt-5'}`}>
      <p className="flex items-center text-[15px]">
        <SettingTitle bookmarkId="marketValueRange">시가총액 범위</SettingTitle>
      </p>
      <SettingDescription>지도에 포함할 종목의 시총 구간</SettingDescription>
      <div className="settings-subsection-list mt-[18px] text-sm">
        <div className="max-w-[16rem]">
          <RangeSlider
            minIndex={tierDisplayMinIndex}
            maxIndex={tierDisplayMaxIndex}
            steps={tierSteps}
            labels={tierDisplayLabels}
            minAriaLabel="최소 시가총액 구간"
            maxAriaLabel="최대 시가총액 구간"
            onChange={(newDisplayMin, newDisplayMax) => {
              onChangeTierRange(tierSteps - newDisplayMax, tierSteps - newDisplayMin)
            }}
            disabled={tiers.length === 0}
          />
        </div>
      </div>
    </div>
  )
}

const DIRECTION_OPTIONS: { value: StockChangeFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'rising', label: '상승' },
  { value: 'falling', label: '하락' },
]

export function SettingsSectorChangeSection({
  value,
  onChange,
  depth,
  onChangeDepth,
  maxSelectableDepth,
}: {
  value: SectorChangeFilter
  onChange: (value: SectorChangeFilter) => void
  depth: number
  onChangeDepth: (depth: number) => void
  maxSelectableDepth: number
}) {
  const bookmark = useContext(SettingsBookmarkContext)

  return (
    <div className={`settings-second-sector-change text-white ${bookmark.mode === 'bookmark' ? '' : 'mt-4 pt-6'} ${bookmarkItemClass(bookmark, 'sectorChange')}`}>
      <p className="flex items-center text-[15px]">
        <SettingTitle bookmarkId="sectorChange" help>업종 등락 방향</SettingTitle>
        <SettingHelpIcon
          bookmarkId="sectorChange"
          label="업종 등락 방향"
          description={<><span className="inline-block whitespace-nowrap border-b border-current">1-2) 표시 지표</span>에서 ‘동일 가중’을 선택하면 동일 가중, 그 외에는 시총 가중 평균을 사용합니다.</>}
        />
      </p>
      <SettingDescription>상승·하락 업종만 표시</SettingDescription>
      {/* 설명 줄 오른쪽에 둔다 — 선택 버튼이 1-2, 2-3과 같은 위치(제목 아래 60px)에 오도록 흐름에서 뺐다. */}
      <div className="absolute right-0 top-[22px]">
        <DepthSelect
          depth={depth}
          onChange={onChangeDepth}
          maxSelectableDepth={maxSelectableDepth}
          ariaLabel="업종 등락 방향 업종 단계"
        />
      </div>
      <div role="radiogroup" aria-label="업종 등락 방향 필터" className="mt-[18px] grid max-w-[16rem] grid-cols-3 rounded-md border border-gray-600 bg-zinc-700 p-0.5">
        {DIRECTION_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-7 rounded px-1 py-1 text-xs font-medium ${value === option.value ? 'bg-[var(--accent)] text-black' : 'border-0 bg-transparent text-gray-300 hover:text-white'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsStockChangeSection({
  value,
  onChange,
}: {
  value: StockChangeFilter
  onChange: (value: StockChangeFilter) => void
}) {
  const bookmark = useContext(SettingsBookmarkContext)
  return (
    <div className={`settings-third-stock-change text-white ${bookmark.mode === 'bookmark' ? '' : 'mt-4 pt-6'} ${bookmarkItemClass(bookmark, 'stockChange')}`}>
      <p className="flex items-center text-[15px]">
        <SettingTitle bookmarkId="stockChange">종목 등락 방향</SettingTitle>
      </p>
      <SettingDescription>상승·하락 종목만 표시</SettingDescription>
      <div role="radiogroup" aria-label="종목 등락 방향 필터" className="mt-[18px] grid max-w-[16rem] grid-cols-3 rounded-md border border-gray-600 bg-zinc-700 p-0.5">
        {DIRECTION_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-7 rounded px-1 py-1 text-xs font-medium ${value === option.value ? 'bg-[var(--accent)] text-black' : 'border-0 bg-transparent text-gray-300 hover:text-white'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsExcludeSection({
  sectorFilterEnabled,
  onToggleSectorFilter,
  excludedSectors,
  onRemoveExcludedSector,
  afterStockChange = false,
}: {
  // 개별 섹터를 켜고 끄는 토글이 아니라, "섹터 제외를 적용할지 말지" 자체를 한 번에 켜고 끄는 스위치.
  // 어떤 섹터를 제외 목록에 넣을지는 마켓맵에서 우클릭으로 추가/이 목록에서 X로 제거하는 것으로만 관리한다.
  sectorFilterEnabled: boolean
  onToggleSectorFilter: () => void
  excludedSectors: ExcludedSector[]
  onRemoveExcludedSector: (sectorId: number) => void
  afterStockChange?: boolean
}) {
  return (
    <div className={`${afterStockChange ? 'settings-fourth-exclude' : 'settings-second-exclude'} mt-4 pt-6 text-white`}>
      <div className="text-sm">
        <ToggleSwitch
          checked={sectorFilterEnabled}
          onChange={onToggleSectorFilter}
          label="제외 업종"
          labelClassName="text-[15px] settings-section-num"
        />
        <SettingDescription>업종을 우클릭해 제외 가능</SettingDescription>
        <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
            {excludedSectors.length === 0 ? (
              <p className="text-xs text-gray-400">제외된 업종이 없습니다.</p>
            ) : (
              excludedSectors.map(sector => (
                <div key={sector.sectorId} className="flex items-center gap-1.5 py-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`${sector.sectorName}\n히트맵으로 복원하시겠습니까?`)) return
                      onRemoveExcludedSector(sector.sectorId)
                    }}
                    aria-label={`${sector.sectorName} 히트맵에 다시 표시`}
                    title="히트맵에 다시 표시"
                    className="flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-transparent text-gray-400 hover:text-gray-200"
                  >
                    <RestoreToMapIcon className="h-4 w-4" />
                  </button>
                  <span className="min-w-0 truncate text-[12px] text-white">{sector.sectorName}</span>
                </div>
              ))
            )}
        </div>
      </div>
    </div>
  )
}

export function SettingsColorSection({
  colorScaleDraft,
  colorCustomOn,
  onChangeColorCustomOn,
  onSelectColorSwatch,
  onResetColorScale,
  isResettingColorScale,
  legendSwatches,
  colorEditorProps,
}: {
  isCustom: boolean
  // 마켓맵 등락률 컬러 스케일 draft(및 그 setter) — null이면 아직 서버 조회 전. 실제 트리맵/범례에
  // 쓰이는 값과 동일한 참조라, 여기서 편집하는 즉시 지도 색이 실시간으로 바뀐다(별도 미리보기 불필요).
  // admin이 아니거나 아직 로딩 전이면 이 섹션 자체가 안 보인다.
  colorScaleDraft: ColorScaleConfig | null
  // "색상 커스텀 모드" 토글 — 순수 로컬(세션스토리지) 상태. draft(=저장 대상)와는 분리돼 있어서
  // 껐다 켜도 draft에 저장해둔 값은 건드리지 않는다.
  colorCustomOn: boolean
  onChangeColorCustomOn: (on: boolean) => void
  // 범례 색상칸의 수정/삭제 메뉴를 제공하고, 편집기는 바로 아래에 표시한다.
  onSelectColorSwatch: (percent: number, color: string) => void
  onResetColorScale: () => void
  isResettingColorScale: boolean
  // 지도 상단 바에 있던 범례를 이 섹션으로 옮겨왔다. 평소에는 박스와 같은 resolver 결과를 쓰고,
  // 편집 중 새로 빈 부호의 fallback 칸만 잠시 숨긴다(useGlobalSettings에서 계산).
  legendSwatches: LegendSwatch[]
  colorEditorProps?: ColorThresholdEditorProps | null
}) {
  // 색상 설정은 비로그인에게도 보인다 — 기본 색상(공개 /map/scale)으로 시작해서 바꿀 수 있고, 비로그인의
  // 변경은 서버에 저장되지 않고 이 탭의 세션에만 남는다(다른 화면 설정과 같다).
  if (colorScaleDraft === null) return null

  // 편집 중인 구간의 범례 칸을 강조해서, 아래 편집 영역이 어느 칸의 것인지 바로 보이게 한다.
  const editingPercent = colorEditorProps?.thresholds[0]?.thresholdPercent

  return (
    <div className="settings-second-color pt-5 text-white">
      {/* "색상 커스텀 모드" 토글을 별도 줄로 두지 않고, 제목 바로 우측에 스위치만 붙인다. */}
      <div className="flex items-center justify-between">
        <p className="flex items-center text-[15px]">
          <span className="settings-section-num">등락률 색상</span>
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { if (window.confirm('등락률 색상을 기본 색상으로 초기화할까요?')) onResetColorScale() }}
            disabled={isResettingColorScale}
            className="-my-px h-6 rounded border border-gray-600 bg-zinc-700 px-2 text-xs text-gray-300 transition-colors hover:border-gray-400 hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            초기화
          </button>
          <ToggleSwitch
            checked={colorCustomOn}
            onChange={() => onChangeColorCustomOn(!colorCustomOn)}
            label="색상 범위 커스텀"
            hideLabel
          />
        </div>
      </div>
      <SettingDescription>등락률 구간별 지도 색상</SettingDescription>
      <div className={`mt-[18px] flex flex-col gap-1 text-sm ${colorCustomOn ? '' : 'pointer-events-none opacity-40'}`}>
        {/* 저장된 색상은 바로 편집하고, 기본 색상은 같은 위치에 새 설정을 만들어 편집한다. */}
        <div className="grid w-full grid-cols-7 gap-0.5">
          {legendSwatches.map(({ label, color }) => {
            const percent = Number.parseFloat(label)
            return (
              <button
                key={label}
                type="button"
                aria-label={`${label} 색상 수정`}
                onClick={() => onSelectColorSwatch(percent, color)}
                style={{ backgroundColor: color }}
                className={`flex h-6 w-full min-w-0 items-center justify-center border p-0 text-white ${percent === editingPercent ? 'border-white ring-1 ring-white/40' : 'border-transparent'}`}
              >
                <span className="text-xs font-bold leading-none whitespace-nowrap">{label}</span>
              </button>
            )
          })}
        </div>
      </div>
      {colorEditorProps && (
        <div className={colorCustomOn ? '' : 'opacity-40'} inert={!colorCustomOn}>
          <MarketMapColorThresholdEditorPanel key={colorEditorProps.sessionKey} {...colorEditorProps} />
        </div>
      )}
    </div>
  )
}

// 맨 왼쪽의 흰색에 가까운 회색은 아래 등락률 색상(4-2)의 회색 자리와 짝이다 — 두 줄이 같은 8칸으로 같은 간격에 놓인다.
const STRONG_INDUSTRY_COLOR_OPTIONS = [
  { label: '연회색', value: '#e5e7eb' },
  { label: '분홍', value: '#fccbcd' },
  { label: '주황', value: '#ffb74d' },
  { label: '연노랑', value: '#fff59d' },
  { label: '형광', value: '#c6ff00' },
  { label: '청록', value: '#4dd0e1' },
  { label: '하늘', value: '#90bff9' },
  { label: '보라', value: '#b39ddb' },
]

export function SettingsStrongIndustryColorSection({
  color,
  onChange,
}: {
  color: string
  onChange: (color: string) => void
}) {
  const bookmark = useContext(SettingsBookmarkContext)
  if (bookmark.mode === 'bookmark' && !bookmark.ids.includes('strongColor')) return null
  return (
    <div className={`settings-first-strong-color text-white ${bookmark.mode === 'bookmark' ? bookmarkItemClass(bookmark, 'strongColor') : 'pt-5'}`}>
      <p className="flex items-center text-[15px]">
        <SettingTitle bookmarkId="strongColor" help>강조 색상</SettingTitle>
        <SettingHelpIcon
          bookmarkId="strongColor"
          label="강조 색상"
          description={<>지도 내 업종명(1단계)과 <span className="inline-block whitespace-nowrap border-b border-current">1-4) 강세 표시</span>의 색상을 설정합니다.</>}
        />
      </p>
      <SettingDescription>업종명과 강세 업종의 색상</SettingDescription>
      <div className="mt-[18px] flex justify-between">
        {STRONG_INDUSTRY_COLOR_OPTIONS.map(option => (
          <span key={option.value} className="group relative inline-flex">
            <button
              type="button"
              aria-label={`${option.label} 색상 선택`}
              aria-pressed={color.toLowerCase() === option.value}
              onClick={() => onChange(option.value)}
              style={{ backgroundColor: option.value }}
              className={`h-6 w-6 shrink-0 rounded-full border-2 p-0 ${color.toLowerCase() === option.value ? 'border-white ring-1 ring-white/40' : 'border-transparent'}`}
            />
            <span
              role="tooltip"
              className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded border border-[#7a6d55] bg-[#fff8e7] px-2 py-1 text-xs text-black opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100"
            >
              {option.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

interface Props {
  // 헤더에 "{pageLabel} 설정"으로 표시 — SubNavBar 탭 이름과 동일한 문구를 각 페이지가 그대로 넘겨준다.
  // 생략하면 페이지 이름 없이 "설정"만 표시한다(페이지 이름을 반복하는 동어 반복을 피하고 싶은 페이지용).
  pageLabel?: string
  // 탭 없이 패널 본문에 바로 그리는 내용 — 설정 항목이 한두 개뿐인 페이지(그룹)용. 탭 분류(children의
  // SettingsSidebarGroup)와 같이 쓰지 않는다.
  plainContent?: ReactNode
  sectionOrder?: readonly SettingsSidebarSectionId[]
  classificationAtBottom?: boolean
  // 하단 히트맵 선택 아래에 표시할 운영자 종목 분류 최종 변경 시각(지도 상단 표기와 같은 형식).
  snapshotTime?: string | null
  // 사이드바 열림 상태는 페이지가 관리한다.
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  // 분류 체계 선택의 탭은 페이지가 정하고, 박스 크기 선택은 종목 박스 탭에 배치한다.
  classificationSection?: 'favorites' | 'industry'
  isCustom?: boolean
  onToggleCustom?: () => void
  // 지도의 히트맵 선택(KRX / NXT / MARKETRY) — 주면 선택 탭이 이 값을 쓰고, 안 주면 isCustom으로 KRX/MARKETRY만 고른다.
  heatmap?: HeatmapKey
  onSelectHeatmap?: (heatmap: HeatmapKey) => void
  avgChangeRateUseSimple?: boolean
  onToggleAvgChangeRateUseSimple?: () => void
  // 지도 페이지의 박스 면적 시가총액 반영 비율(0=동일 크기, 100=시가총액 비례).
  boxSizeMarketCapRatio?: number
  onChangeBoxSizeMarketCapRatio?: (value: number) => void
  // 지도 페이지의 현재/전체 종목 수를 제목 바로 옆에 표시한다.
  stockCountLabel?: string
  // 핀 — 켜 두면(기본) 지도 옆에 고정(지도를 밀어냄)하고, 끄면 지도 위에 띄운다(밖을 누르면 닫힘). 넘기지 않은 페이지는 기존처럼 닫기(✕) 버튼을 보여준다.
  isPinned?: boolean
  onTogglePinned?: () => void
  // 북마크 기능 — 둘 다 넘긴 페이지에서만 항목 옆 북마크 버튼과 북마크 탭 내용이 동작한다.
  bookmarks?: readonly string[]
  onToggleBookmark?: (id: SettingsBookmarkId) => void
  // 비로그인이면 북마크 탭을 누를 때 탭을 열지 않고 이 함수(로그인 팝업)를 부른다.
  bookmarkLoginRequired?: boolean
  onRequestLogin?: () => void
  // 실제로 보여줄 옵션 섹션들 — 페이지가 자기한테 유효한 Settings*Section만 골라 조립한다.
  // 아무것도 안 넘기면(요약/어드민처럼 이 설정이 전혀 적용 안 되는 페이지) 헤더만 있는 빈 사이드바가 된다.
  children?: ReactNode
}

// 팝업이 아니라 실제 렌더링 영역을 왼쪽으로 밀어내는 도킹형 사이드바 — 헤더 + 스크롤 바디만 그리는
// 껍데기고, 실제 옵션 내용은 전부 위 Settings*Section들을 children으로 조립해서 채운다.
function isSettingsSidebarGroup(node: ReactNode): node is ReactElement<SettingsSidebarGroupProps> {
  return isValidElement<SettingsSidebarGroupProps>(node) && node.type === SettingsSidebarGroup
}

export default function SettingsSidebar({
  pageLabel,
  sectionOrder,
  classificationAtBottom = false,
  snapshotTime,
  classificationSection = 'industry',
  isOpen,
  onOpenChange,
  isCustom,
  onToggleCustom,
  heatmap,
  onSelectHeatmap,
  avgChangeRateUseSimple,
  onToggleAvgChangeRateUseSimple,
  boxSizeMarketCapRatio,
  onChangeBoxSizeMarketCapRatio,
  stockCountLabel,
  isPinned,
  onTogglePinned,
  bookmarks,
  onToggleBookmark,
  bookmarkLoginRequired = false,
  onRequestLogin,
  plainContent,
  children,
}: Props) {
  const [activeSection, setActiveSection] = useState<SettingsSidebarSectionId>(sectionOrder?.[0] ?? 'composition')
  const childNodes = Children.toArray(children)
  const sectionContent = new Map<SettingsSidebarSectionId, ReactNode[]>()
  const addSectionContent = (section: SettingsSidebarSectionId, content: ReactNode) => {
    const existing = sectionContent.get(section) ?? []
    existing.push(content)
    sectionContent.set(section, existing)
  }

  for (const node of childNodes) {
    if (!isSettingsSidebarGroup(node)) continue
    addSectionContent(node.props.section, node.props.children)
  }

  // 기존 페이지에서 아직 group wrapper를 붙이지 않은 아이들은 종목 구성 탭에 넣어 이전 호출부도
  // 계속 표시한다. 각 페이지 통합이 끝나면 모든 설정이 명시적인 group 아래에 놓인다.
  const ungroupedNodes = childNodes.filter(node => !isSettingsSidebarGroup(node))
  if (ungroupedNodes.length > 0) addSectionContent('composition', ungroupedNodes)
  if (sectionContent.size > 0 && !sectionContent.has('favorites')) {
    addSectionContent('favorites', <SettingsFavoritesPlaceholder />)
  }

  const hasClassificationSelector = typeof isCustom === 'boolean' && Boolean(onToggleCustom)
  const selectedHeatmap: HeatmapKey = heatmap ?? (isCustom ? 'marketry' : 'krx')
  const handleSelectHeatmap = onSelectHeatmap ?? (() => onToggleCustom?.())
  const hasStockSizeSelector = typeof avgChangeRateUseSimple === 'boolean' && Boolean(onToggleAvgChangeRateUseSimple)
  const hasBoxSizeRatioSlider = typeof boxSizeMarketCapRatio === 'number' && Boolean(onChangeBoxSizeMarketCapRatio)

  const availableSections = SETTINGS_SECTIONS.filter(section => sectionContent.has(section.id))
  if (sectionOrder) {
    availableSections.sort((a, b) => sectionOrder.indexOf(a.id) - sectionOrder.indexOf(b.id))
  }
  const selectedSection = availableSections.find(section => section.id === activeSection) ?? availableSections[0]
  const isNonScrollingSection = !classificationAtBottom && (selectedSection?.id === 'industry' || selectedSection?.id === 'colors')

  // 북마크 탭에는 원래 위치 번호(탭 번호-항목 번호)를 보여준다. 항목 번호는 각 탭에서 항상 고정된 자리다.
  const sourceTabNumber = (id: SettingsSidebarSectionId) => availableSections.findIndex(section => section.id === id) + 1
  const bookmarkContext: SettingsBookmarkContextValue = {
    enabled: Boolean(onToggleBookmark),
    mode: selectedSection?.id === 'favorites' ? 'bookmark' : 'source',
    ids: bookmarks ?? [],
    firstId: BOOKMARK_ORDER.find(id => (bookmarks ?? []).includes(id)),
    numbers: {
      depthLevel: `${sourceTabNumber('industry')}-1`,
      depthMetric: `${sourceTabNumber('industry')}-2`,
      depthRange: `${sourceTabNumber('industry')}-3`,
      topPick: `${sourceTabNumber('industry')}-4`,
      marketValueRange: `${sourceTabNumber('composition')}-1`,
      sectorChange: `${sourceTabNumber('composition')}-2`,
      stockChange: `${sourceTabNumber('composition')}-3`,
      boxSize: `${sourceTabNumber('stockDisplay')}-1`,
      boxLabel: `${sourceTabNumber('stockDisplay')}-2`,
      textThreshold: `${sourceTabNumber('stockDisplay')}-3`,
      decimalPlaces: `${sourceTabNumber('stockDisplay')}-4`,
      strongColor: `${sourceTabNumber('colors')}-1`,
    },
    onToggle: id => onToggleBookmark?.(id),
  }

  // 닫혀있을 땐 아예 렌더링하지 않는다(트리거 버튼은 더 이상 이 컴포넌트가 아니라 호출부가 따로 그린다).
  if (!isOpen) return null

  return (
    <div
      data-settings-sidebar
      // 핀을 끈 상태는 자리를 차지하지 않고 지도 위에 띄운다 — 부모(지도 영역)가 relative라서 오른쪽 끝에 붙는다.
      className={`tabular-nums flex w-72 shrink-0 flex-col overflow-hidden rounded-md border border-gray-500 bg-[#363639] ${
        onTogglePinned && !isPinned ? 'absolute bottom-0 right-0 top-0 z-40 shadow-2xl' : ''
      }`}
      style={{ '--accent': '#d1d5db', '--accent-hover': '#f3f4f6', '--accent-light': '#d1d5db' } as CSSProperties}
    >
      <div className="flex shrink-0 items-center border-b border-gray-500 px-4 pt-4 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="flex h-7 items-center whitespace-nowrap text-lg font-bold leading-none text-white">{pageLabel ? `${pageLabel} 설정` : '설정'}</p>
          {stockCountLabel && (
            <span className="flex h-7 w-[7rem] shrink-0 items-center justify-end whitespace-nowrap text-right text-sm leading-none text-gray-400">
              {stockCountLabel}
            </span>
          )}
        </div>
        {onTogglePinned ? (
          <button
            type="button"
            onClick={onTogglePinned}
            aria-label={isPinned ? '고정 해제' : '고정'}
            aria-pressed={Boolean(isPinned)}
            title={isPinned ? '고정됨 — 지도 옆에 항상 열어 둡니다. 누르면 지도 위에 띄우는 방식으로 바꿉니다.' : '지도 위에 떠 있음 — 지도를 밀지 않고, 밖을 누르면 닫힙니다. 누르면 고정합니다.'}
            className={`ml-auto mr-[6px] flex h-5 w-5 shrink-0 items-center justify-center border-0 bg-transparent p-0 ${isPinned ? 'text-[var(--brand)]' : 'text-gray-400 hover:text-white'}`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 17v5" />
              <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
            }}
            aria-label="닫기"
            className="ml-auto mr-2 shrink-0 border-0 bg-transparent text-xl text-gray-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>
      {plainContent && (
        <div className="settings-section-list settings-sidebar-tab-content min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-8 text-sm">
          {plainContent}
        </div>
      )}
      {availableSections.length > 0 && (
      <nav role="tablist" aria-label={pageLabel ? `${pageLabel} 설정 분류` : '설정 분류'} className="flex h-[68px] shrink-0 items-stretch border-b border-gray-500 bg-[#363639] px-1">
          {availableSections.map(section => {
            const selected = section.id === selectedSection?.id
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`settings-panel-${section.id}`}
                id={`settings-tab-${section.id}`}
                onClick={() => {
                  // 비로그인이 북마크 탭을 누르면 탭을 열지 않고 바로 로그인 팝업을 띄운다.
                  if (section.id === 'favorites' && bookmarkLoginRequired && onRequestLogin) onRequestLogin()
                  else setActiveSection(section.id)
                }}
                className={`group relative box-border flex h-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-0 bg-transparent px-1 pt-2 pb-3 text-[12px] leading-tight transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--accent)] ${
                  selected ? 'text-[var(--accent)]' : 'text-gray-400 hover:text-white'
                }`}
              >
                <SettingsSectionIcon icon={section.icon} />
                <span className="max-w-full truncate font-bold">{section.label}</span>
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-2 bottom-0 h-0.5 bg-[var(--accent)] transition-opacity ${selected ? 'opacity-100' : 'opacity-0'}`}
                />
              </button>
            )
          })}
        </nav>
      )}
      <SettingsBookmarkContext.Provider value={bookmarkContext}>
      {selectedSection && (
        <div
          role="tabpanel"
          id={`settings-panel-${selectedSection.id}`}
          aria-labelledby={`settings-tab-${selectedSection.id}`}
          data-align-second-heading={(classificationAtBottom && selectedSection.id !== 'favorites') || undefined}
          className={`settings-section-list settings-sidebar-tab-content min-h-0 flex-1 px-4 text-sm ${selectedSection.id === 'favorites' ? 'settings-bookmark-tab' : ''} ${
            isNonScrollingSection ? 'overflow-y-clip pb-2' : 'overflow-y-auto pb-8'
          }`}
        >
          {!classificationAtBottom && selectedSection.id === classificationSection && hasClassificationSelector && (
            <SettingsClassificationSelector heatmap={selectedHeatmap} onSelectHeatmap={handleSelectHeatmap} />
          )}
          {selectedSection.id === 'stockDisplay' && hasBoxSizeRatioSlider ? (
            <SettingsStockSizeSelector
              marketCapRatio={boxSizeMarketCapRatio!}
              onChangeMarketCapRatio={onChangeBoxSizeMarketCapRatio!}
            />
          ) : selectedSection.id === 'stockDisplay' && hasStockSizeSelector ? (
            <SettingsAverageModeSelector
              avgChangeRateUseSimple={avgChangeRateUseSimple!}
              onToggleAvgChangeRateUseSimple={onToggleAvgChangeRateUseSimple!}
            />
          ) : null}
          {selectedSection.id === 'favorites' && bookmarkContext.enabled && bookmarkContext.ids.length === 0 && (
            <p className="text-xs leading-relaxed text-gray-400">
              북마크한 항목이 없습니다.
            </p>
          )}
          {sectionContent.get(selectedSection.id)?.map((content, index) => <Fragment key={index}>{content}</Fragment>)}
        </div>
      )}
      </SettingsBookmarkContext.Provider>
      {classificationAtBottom && hasClassificationSelector && availableSections.length > 0 && (
        <SettingsClassificationSelector heatmap={selectedHeatmap} onSelectHeatmap={handleSelectHeatmap} atBottom snapshotTime={snapshotTime} />
      )}
    </div>
  )
}
