import { Children, Fragment, isValidElement, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { useIsLoggedIn } from '@/hooks/useSession'
import type { DepthMetric } from '@/hooks/useGlobalSettings'
import type { StockChangeFilter, SectorChangeFilter } from '@/hooks/useFilteredMarketMapTree'
import type { ColorScaleConfig, ColorScaleThreshold, LegendSwatch } from '@/utils/marketMapColorScale'
import MarketMapColorThresholdEditorPanel, { type ColorThresholdEditorProps } from '@/components/MarketMapColorThresholdEditorPanel'
import SettingsSectionIcon, { type SettingsSectionIconName } from '@/components/SettingsSectionIcon'
import { RestoreToMapIcon } from '@/components/icons/MarketMapIcons'
import type { MarketValueTierItem } from '@/types/api'
import { HEATMAP_NAMES } from '@/utils/heatmapNames'

export type SettingsSidebarSectionId = 'favorites' | 'composition' | 'industry' | 'stockDisplay' | 'colors'

interface SettingsSidebarGroupProps {
  section: SettingsSidebarSectionId
  children?: ReactNode
}

// 각 페이지가 자기 설정을 참조 탭 아래에 배치한다. SettingsSidebar는 활성 탭의 그룹만 렌더링한다.
export function SettingsSidebarGroup({ children }: SettingsSidebarGroupProps) {
  return <>{children}</>
}

function SettingHelpIcon({ label, description }: { label: string; description: ReactNode }) {
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
  )
}

const SETTINGS_SECTIONS: { id: SettingsSidebarSectionId; label: string; icon: SettingsSectionIconName }[] = [
  { id: 'composition', label: '종목 구성', icon: 'composition' },
  { id: 'industry', label: '업종 분류', icon: 'industry' },
  { id: 'stockDisplay', label: '종목 표시', icon: 'stock-display' },
  { id: 'colors', label: '색상 변경', icon: 'colors' },
  { id: 'favorites', label: '즐겨찾기', icon: 'favorites' },
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
        className="w-full accent-[var(--accent)] disabled:cursor-not-allowed"
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
  isCustom,
  onToggleCustom,
  atBottom = false,
}: {
  isCustom: boolean
  onToggleCustom: () => void
  atBottom?: boolean
}) {
  const options = [
    { value: null, label: HEATMAP_NAMES.mine.tab },
    { value: false, label: HEATMAP_NAMES.krx.tab },
    { value: null, label: HEATMAP_NAMES.nxt.tab },
    { value: true, label: HEATMAP_NAMES.marketry.tab },
  ]

  return (
    <div className={`${atBottom ? 'shrink-0 px-4 py-3' : 'mb-6 pt-5 pb-6'} text-white`}>
      <p className="flex items-center text-base">
        히트맵 선택
        <SettingHelpIcon label="히트맵 선택" description="지도에서 볼 히트맵을 선택합니다." />
      </p>
      <div role="radiogroup" aria-label="히트맵 선택" className="mt-2 grid grid-cols-4 rounded-md border border-gray-600 bg-zinc-700 p-0.5">
        {options.map(option => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={option.value !== null && isCustom === option.value}
            onClick={() => option.value !== null && isCustom !== option.value && onToggleCustom()}
            disabled={option.value === null}
            title={option.value === null ? '준비 중' : undefined}
            className={`min-h-8 rounded px-0.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              option.value === null
                ? 'cursor-not-allowed border-0 bg-transparent text-gray-500'
                : isCustom === option.value
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

function SettingsStockSizeSelector({
  marketCapRatio,
  onChangeMarketCapRatio,
}: {
  marketCapRatio: number
  onChangeMarketCapRatio: (value: number) => void
}) {
  return (
    <div className="settings-first-stock-size mb-6 pt-5 pb-6 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <p className="settings-section-num text-[15px]">박스 크기</p>
          <SettingHelpIcon label="박스 크기" description="박스 면적 = 시가총액^(비율 ÷ 100)으로 계산합니다. 0%는 모든 종목을 같은 크기로, 50%는 시가총액의 제곱근 비율로, 100%는 시가총액 비례로 표시합니다." />
        </div>
        <span className="text-sm text-gray-400">{marketCapRatio}%</span>
      </div>
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={marketCapRatio}
          aria-label="박스 크기 시가총액 비율"
          aria-valuetext={`${marketCapRatio}%`}
          onChange={e => onChangeMarketCapRatio(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
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
  showTopPick = false,
  showDecimalPlaces = false,
  showDivider = false,
  showClassification = true,
  showStockDisplay = true,
}: {
  // "업종 분류 탭" 위에 구분선(border-t)을 그릴지 — 스티키 커스텀모드 블록(또는 동일 가중) 바로 다음에
  // 올 때는 그 자체로 이미 구분되므로 false로 끈다. "종목 박스"는 "업종 분류 탭" 바로 다음이라 항상 그린다.
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
  // true면 지도 페이지에만 선호 업종 설정을 추가한다.
  showTopPick?: boolean
  // true면 "종목 박스" 그룹에 "등락률 소수점" 슬라이더를 같이 그린다 — 지도 페이지에서 실제로 트리맵
  // 등락률(%) 표시에 쓰이는 설정이라 지도 페이지에서만 켠다(섹터는 그래프 자체 소수점 포맷을 따로
  // 쓰므로 기본 false로 숨긴다).
  showDecimalPlaces?: boolean
  // 업종 분류 설정과 종목 박스 표기를 서로 다른 사이드바 탭에서 보여줄 수 있다.
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
  // 선택값은 저장한 범위를 그대로 유지하되, 현재 업종 분류 레벨을 넘는 부분만 화면에서 잘라 보여준다.
  const depthMetricSliderMinIndex = Math.min(depthMetricMinIndex, depthMetricMaxSelectableIndex)
  const depthMetricSliderMaxIndex = Math.min(depthMetricMaxIndex, depthMetricMaxSelectableIndex)
  const isDepthMetricRangeDisabled = isDepthMetricDisabled || !depthMetricEnabled
  const [depthMetricSectionHintVisible, setDepthMetricSectionHintVisible] = useState(false)
  const [topPickSectionHintVisible, setTopPickSectionHintVisible] = useState(false)
  const [topPickLimitHintVisible, setTopPickLimitHintVisible] = useState(false)
  const [textThresholdHintVisible, setTextThresholdHintVisible] = useState(false)
  const depthMetricRangeDisabledReason = !sectorLevelEnabled
    ? <><span className="inline-block whitespace-nowrap border-b border-current">1) 분류 단계</span>를 켜야 선택이 가능합니다.</>
    : !depthMetricEnabled
      ? <><span className="inline-block whitespace-nowrap border-b border-current">1-2) 업종 표시 지표</span>를 켜야 선택이 가능합니다.</>
      : null

  return (
    <div className="text-white">
      {showClassification && <div className={showDivider ? 'mt-6 pt-8' : 'pt-5'}>
        <div>
          <div className="text-sm">
            <div className="flex max-w-[16rem] items-center justify-between">
              <span className="flex items-center text-left text-white">
                <span className="settings-section-num text-[15px]">분류 단계</span>
                <SettingHelpIcon label="분류 단계" description="지도에 표시할 업종 분류의 깊이를 설정합니다." />
              </span>
              <ToggleSwitch
                checked={sectorLevelEnabled}
                onChange={onToggleSectorLevel}
                label="분류 단계 사용"
                hideLabel
                compact
              />
            </div>
            <div className={`mt-2 max-w-[16rem] ${sectorLevelEnabled ? '' : 'opacity-40'}`}>
              <SingleValueSlider
                index={depthValue - 1}
                labels={depthMetricLabels}
                ariaLabel="분류 단계"
                onChange={index => onChangeMaxDepth(index + 1)}
                disabled={!sectorLevelEnabled}
              />
            </div>
          </div>
          <div className="settings-second-depth-metric relative mt-6 text-sm">
            <div className={isDepthMetricDisabled ? 'opacity-40' : ''}>
              <div className="flex max-w-[16rem] items-center justify-between">
                <span className="flex items-center text-left text-white">
                  <span className="settings-section-num text-[15px]">업종 표시 지표</span>
                  <SettingHelpIcon label="업종 표시 지표" description="업종 항목에 표시할 지표를 선택합니다." />
                </span>
                <ToggleSwitch
                  checked={depthMetricEnabled}
                  onChange={onToggleDepthMetric}
                  label="업종 표시 지표 사용"
                  hideLabel
                  compact
                  disabled={isDepthMetricDisabled}
                />
              </div>
              <div role="radiogroup" aria-label="업종 표시 지표" className={`mt-3 grid max-w-[16rem] grid-cols-4 rounded-md border border-gray-600 bg-zinc-700 p-0.5 ${depthMetricEnabled ? '' : 'opacity-40'}`}>
                {GROUP_TAB_METRIC_OPTIONS.map(option => (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={activeDepthMetric === option.key}
                    onClick={() => onChangeActiveDepthMetric(option.key)}
                    disabled={isDepthMetricDisabled || !depthMetricEnabled}
                    className={`min-h-8 rounded px-0.5 py-1 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed ${
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
                <span className="inline-block whitespace-nowrap border-b border-current">1) 분류 단계</span>를 켜야 선택이 가능합니다.
              </div>
            )}
          </div>
          <div
            aria-disabled={isDepthMetricRangeDisabled}
            className={`settings-third-depth-range mt-6 text-sm ${isDepthMetricRangeDisabled ? 'cursor-not-allowed' : ''}`}
          >
            <span className={`flex items-center text-left text-[15px] text-white ${isDepthMetricRangeDisabled ? 'opacity-40' : ''}`}>
              <span className="settings-section-num">지표 표시 위치</span>
              <SettingHelpIcon label="지표 표시 위치" description="선택한 지표를 어느 업종 분류 단계에 나타낼지 정합니다." />
            </span>
            <div className="mt-2 max-w-[16rem]">
              <RangeSlider
                minIndex={depthMetricSliderMinIndex}
                maxIndex={depthMetricSliderMaxIndex}
                steps={depthMetricSliderSteps}
                labels={depthMetricLabels}
                minAriaLabel="최소 표시 뎁스"
                maxAriaLabel="최대 표시 뎁스"
                maxSelectableIndex={depthMetricMaxSelectableIndex}
                limitReason={<><span className="inline-block whitespace-nowrap border-b border-current">1) 분류 단계</span>를 높여야 선택이 가능합니다.</>}
                disabledReason={depthMetricRangeDisabledReason}
                onChange={onChangeDepthMetricRange}
                disabled={isDepthMetricRangeDisabled}
              />
            </div>
          </div>
          {showTopPick && (
            <div className="settings-fourth-top-pick relative mt-6 text-sm">
              <div className={isTopPickDisabled ? 'opacity-40' : ''}>
                <div className="flex max-w-[16rem] items-center justify-between">
                  <span className="flex items-center text-left text-white">
                    <span className="settings-section-num text-[15px]">강세 업종 표시</span>
                    <SettingHelpIcon
                      label="강세 업종 표시"
                      description={<>등락률이 높은 업종을 지도에서 강조합니다.<br /><br />시총 가중 등락률을 기준으로 합니다.<br />ETF 등락률을 추종하고자 하였습니다.<br /><br /><span className="inline-block whitespace-nowrap border-b border-current">1-2) 업종 표시 지표</span>에서 동일 가중을 선택한 경우는 예외로 합니다.</>}
                    />
                  </span>
                  <ToggleSwitch
                    checked={topPickEnabled}
                    onChange={onToggleTopPick}
                    label="강세 업종 표시 사용"
                    hideLabel
                    compact
                    disabled={isTopPickDisabled}
                  />
                </div>
                <div
                  role="radiogroup"
                  aria-label="강세 업종 표시 분류 단계"
                  className={`relative mt-2 flex max-w-[16rem] flex-row items-center gap-3 whitespace-nowrap text-xs ${topPickEnabled ? '' : 'opacity-40'}`}
                >
                  {DEPTH_LABELS.map((label, index) => {
                    const isDepthCapped = index >= topPickMaxSelectableDepth
                    const isOptionDisabled = isTopPickDisabled || !topPickEnabled || isDepthCapped
                    return (
                      <span
                        key={label}
                        className={`relative inline-flex ${isDepthCapped && topPickEnabled && !isTopPickDisabled ? 'cursor-not-allowed' : ''}`}
                        onPointerEnter={isDepthCapped && topPickEnabled && !isTopPickDisabled ? () => setTopPickLimitHintVisible(true) : undefined}
                        onPointerLeave={isDepthCapped ? () => setTopPickLimitHintVisible(false) : undefined}
                        onPointerDown={isDepthCapped && topPickEnabled && !isTopPickDisabled ? e => {
                          e.preventDefault()
                          setTopPickLimitHintVisible(true)
                        } : undefined}
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={topPickDepth === index}
                          onClick={() => onChangeTopPickDepth(index)}
                          disabled={isOptionDisabled}
                          className={`border-0 bg-transparent p-0 text-left text-xs disabled:cursor-not-allowed ${
                            topPickDepth === index ? 'text-white' : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                        {isDepthCapped && topPickEnabled && !isTopPickDisabled && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 z-10 cursor-not-allowed"
                            onPointerDown={e => {
                              e.preventDefault()
                              setTopPickLimitHintVisible(true)
                            }}
                          />
                        )}
                      </span>
                    )
                  })}
                  {topPickEnabled && !isTopPickDisabled && topPickLimitHintVisible && DEPTH_LABELS.some((_, index) => index >= topPickMaxSelectableDepth) && (
                    <div role="status" className={BLOCKED_HINT_CLASS}>
                      <span className="inline-block whitespace-nowrap border-b border-current">1) 분류 단계</span>를 높여야 선택이 가능합니다.
                    </div>
                  )}
                </div>
                <div className={`mt-2 max-w-[16rem] ${topPickEnabled ? '' : 'opacity-40'}`}>
                  <SingleValueSlider
                    index={topPickCount - 1}
                    labels={TOP_PICK_COUNT_LABELS}
                    ariaLabel="강세 업종 표시 개수"
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
                <span className="inline-block whitespace-nowrap border-b border-current">1) 분류 단계</span>를 켜야 선택이 가능합니다.
                </div>
              )}
            </div>
          )}
        </div>
      </div>}
      {/* 종목 표시 탭의 박스 크기 다음에 종목 표기, 텍스트 표시 기준, 등락률 소수점을
          같은 번호 위계로 이어서 표시한다. */}
      {showStockDisplay && <div className={showClassification ? 'mt-6 pt-8' : 'pt-0'}>
        <div>
          <div className="mt-2 text-sm">
            <div className="flex max-w-[16rem] items-center justify-between">
              <span className="flex items-center text-left text-white">
                <span className="settings-section-num text-[15px]">박스 내 표기</span>
                <SettingHelpIcon label="박스 내 표기" description="종목 박스 안에 종목명, 등락률 중 표시할 내용을 선택합니다." />
              </span>
              <ToggleSwitch
                checked={stockLabelEnabled}
                onChange={onToggleStockLabel}
                label="박스 내 표기 사용"
                hideLabel
                compact
              />
            </div>
            <div
              role="radiogroup"
              aria-label="박스 내 표기"
              className={`mt-2 grid max-w-[16rem] grid-cols-3 rounded-md border border-gray-600 bg-zinc-700 p-0.5 ${stockLabelEnabled ? '' : 'opacity-40'}`}
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
            className={`settings-third-text-threshold relative mt-6 text-sm ${stockLabelEnabled ? '' : 'cursor-not-allowed'}`}
            onPointerEnter={!stockLabelEnabled ? () => setTextThresholdHintVisible(true) : undefined}
            onPointerLeave={() => setTextThresholdHintVisible(false)}
            onPointerDown={!stockLabelEnabled ? e => {
              e.preventDefault()
              setTextThresholdHintVisible(true)
            } : undefined}
          >
            {/* 퍼센티지 값은 우측 끝에 옅은 회색으로 — 그 값이 없다고 치면 라벨만 가운데 정렬된 것처럼
                보이도록, 라벨을 flex-1로 남는 공간에서 가운데 정렬한다("업종 분류 레벨" + N/M 배지와
                동일한 패턴). 값 변경은 아래 슬라이더로만 한다. */}
            <div className="flex max-w-[16rem] items-center justify-between">
              <span className="flex items-center text-left text-[15px] text-white">
                <span className="settings-section-num">텍스트 표시 기준</span>
                <SettingHelpIcon
                  label="텍스트 표시 기준"
                  description={<>박스 면적이 기준보다 작은 종목은 종목명과 등락률을 숨깁니다.<br /><br />기준 퍼센트는 지도 전체 면적 대비 종목 박스 면적입니다.</>}
                />
              </span>
              <span className="text-gray-400">{boxLabelMinAreaPercent.toFixed(2)}%</span>
            </div>
            <div className={`mt-2 max-w-[16rem] ${stockLabelEnabled ? '' : 'opacity-40'}`}>
              <input
                type="range"
                min={0.01}
                max={0.3}
                step={0.01}
                value={boxLabelMinAreaPercent}
                onChange={e => onChangeBoxLabelMinAreaPercent(Number(e.target.value))}
                disabled={!stockLabelEnabled}
                className="w-full accent-[var(--accent)] disabled:cursor-not-allowed"
              />
            </div>
            {!stockLabelEnabled && textThresholdHintVisible && (
              <div role="status" className={BLOCKED_HINT_CLASS}>
                <span className="inline-block whitespace-nowrap border-b border-current">1) 박스 내 표기</span>를 켜야 선택이 가능합니다.
              </div>
            )}
          </div>
          {showDecimalPlaces && (
            <div className="settings-fourth-decimal-places mt-6 text-sm">
              <span className="flex max-w-[16rem] items-center text-left text-[15px] text-white">
                <span className="settings-section-num">등락률 소수점</span>
                <SettingHelpIcon label="등락률 소수점" description="종목 등락률에 표시할 소수점 자릿수를 선택합니다." />
              </span>
              <div className="mt-2 max-w-[16rem]">
                <SingleValueSlider
                  index={decimalPlacesIndex}
                  labels={DECIMAL_PLACES_LABELS}
                  ariaLabel="등락률 소수점 자릿수"
                  onChange={onChangeDecimalPlacesIndex}
                />
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
  const tierSteps = Math.max(tiers.length - 1, 1)
  const tierDisplayLabels = [...tiers].reverse().map(tier => tier.label)
  const tierDisplayMinIndex = tierSteps - tierRangeMaxIndex
  const tierDisplayMaxIndex = tierSteps - tierRangeMinIndex

  return (
    <div className={showDivider ? 'mt-6 pt-8 text-white' : 'pt-5 text-white'}>
      <p className="flex items-center text-[15px]">
        <span className="settings-section-num">시가총액 범위</span>
        <SettingHelpIcon label="시가총액 범위" description="지도에 포함할 종목의 시가총액 구간을 선택합니다." />
      </p>
      <div className="settings-subsection-list mt-2 text-sm">
        <div className="mt-2 max-w-[16rem]">
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
  const [limitHintVisible, setLimitHintVisible] = useState(false)

  return (
    <div className="settings-second-sector-change mt-4 pt-6 text-white">
      <p className="flex items-center text-[15px]">
        <span className="settings-section-num">업종 등락 방향</span>
        <SettingHelpIcon
          label="업종 등락 방향"
          description={<><span className="inline-block whitespace-nowrap border-b border-current">2) 업종 등락 방향</span>에서 고른 분류 단계의 상승·하락 업종만 표시합니다.<br /><br /><span className="inline-block whitespace-nowrap border-b border-current">1-2) 업종 표시 지표</span>에서 ‘동일 가중’을 선택하면 동일 가중, 그 외에는 시총 가중 평균을 사용합니다.</>}
        />
      </p>
      <div
        role="radiogroup"
        aria-label="업종 등락 방향 분류 단계"
        className="relative mt-3 flex max-w-[16rem] items-center gap-3 text-xs"
        onPointerLeave={() => setLimitHintVisible(false)}
      >
        {DEPTH_LABELS.map((label, index) => {
          const isDepthCapped = index >= maxSelectableDepth
          return (
            <span
              key={label}
              className={`relative inline-flex ${isDepthCapped ? 'cursor-not-allowed' : ''}`}
              onPointerEnter={isDepthCapped ? () => setLimitHintVisible(true) : undefined}
            >
              <button
                type="button"
                role="radio"
                aria-checked={depth === index}
                onClick={() => onChangeDepth(index)}
                disabled={isDepthCapped}
                className={`border-0 bg-transparent p-0 text-left disabled:cursor-not-allowed disabled:text-gray-600 ${depth === index ? 'text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {label}
              </button>
              {isDepthCapped && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 z-10 cursor-not-allowed"
                  onPointerDown={event => {
                    event.preventDefault()
                    setLimitHintVisible(true)
                  }}
                />
              )}
            </span>
          )
        })}
        {limitHintVisible && DEPTH_LABELS.some((_, index) => index >= maxSelectableDepth) && (
          <div role="status" className={BLOCKED_HINT_CLASS}>
            <span className="inline-block whitespace-nowrap border-b border-current">1-1) 분류 단계</span>를 높여야 선택이 가능합니다.
          </div>
        )}
      </div>
      <div role="radiogroup" aria-label="업종 등락 방향 필터" className="mt-3 grid max-w-[16rem] grid-cols-3 rounded-md border border-gray-600 bg-zinc-700 p-0.5">
        {DIRECTION_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-8 rounded px-1 py-1 text-xs font-medium ${value === option.value ? 'bg-[var(--accent)] text-black' : 'border-0 bg-transparent text-gray-300 hover:text-white'}`}
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
  return (
    <div className="mt-4 pt-6 text-white">
      <p className="flex items-center text-[15px]">
        <span className="settings-section-num">종목 등락 방향</span>
        <SettingHelpIcon label="종목 등락 방향" description="상승 또는 하락한 종목만 지도에 표시합니다." />
      </p>
      <div role="radiogroup" aria-label="종목 등락 방향 필터" className="mt-3 grid max-w-[16rem] grid-cols-3 rounded-md border border-gray-600 bg-zinc-700 p-0.5">
        {DIRECTION_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-8 rounded px-1 py-1 text-xs font-medium ${value === option.value ? 'bg-[var(--accent)] text-black' : 'border-0 bg-transparent text-gray-300 hover:text-white'}`}
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
    <div className={`${afterStockChange ? '' : 'settings-second-exclude'} mt-4 pt-6 text-white`}>
      <div className="text-sm">
        <ToggleSwitch
          checked={sectorFilterEnabled}
          onChange={onToggleSectorFilter}
          label="제외 업종 변경"
          labelClassName="text-[15px] settings-section-num"
          labelSuffix={<SettingHelpIcon label="제외 업종 변경" description="업종을 우클릭해 제외하고, 제외 목록에서 다시 표시할 수 있습니다." />}
        />
        <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
            {excludedSectors.length === 0 ? (
              <p className="text-xs text-gray-400">제외된 범위 없음</p>
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
  onAddColorThreshold,
  onEditColorThreshold,
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
  onAddColorThreshold: (preset?: ColorScaleThreshold) => void
  onEditColorThreshold: (index: number) => void
  // 지도 상단 바에 있던 범례를 이 섹션으로 옮겨왔다. 평소에는 박스와 같은 resolver 결과를 쓰고,
  // 편집 중 새로 빈 부호의 fallback 칸만 잠시 숨긴다(useGlobalSettings에서 계산).
  legendSwatches: LegendSwatch[]
  colorEditorProps?: ColorThresholdEditorProps | null
}) {
  // 색상 범위는 /api/custom/scale(로그인 사용자 본인 값)을 쓰는 커스텀 데이터라, admin 여부가 아니라
  // 로그인 여부로 노출을 가른다(가입/로그인 전환 지시서: useIsAdmin 기반 커스텀 게이팅을 로그인 게이팅으로 전환).
  const isLoggedIn = useIsLoggedIn()
  if (!isLoggedIn || colorScaleDraft === null) return null

  const thresholdIndices = new Map(colorScaleDraft.thresholds.map((threshold, index) => [threshold.thresholdPercent, index]))

  return (
    <div className="pt-5 text-white">
      {/* "색상 커스텀 모드" 토글을 별도 줄로 두지 않고, 제목 바로 우측에 스위치만 붙인다. */}
      <div className="flex items-center justify-between">
        <p className="flex items-center text-[15px]">
          <span className="settings-section-num">등락률 색상</span>
          <SettingHelpIcon label="등락률 색상" description="등락률 구간마다 지도에 표시할 색상을 설정합니다." />
        </p>
        <ToggleSwitch
          checked={colorCustomOn}
          onChange={() => onChangeColorCustomOn(!colorCustomOn)}
          label="색상 범위 커스텀"
          disabled={Boolean(colorEditorProps)}
          hideLabel
        />
      </div>
      <div className={`mt-3 flex flex-col gap-1 text-sm ${colorCustomOn ? '' : 'pointer-events-none opacity-40'}`}>
        {/* 저장된 색상은 바로 편집하고, 기본 색상은 같은 위치에 새 설정을 만들어 편집한다. */}
        <div className="grid w-full grid-cols-7 gap-0.5">
          {legendSwatches.map(({ label, color }) => {
            const percent = Number.parseFloat(label)
            const thresholdIndex = thresholdIndices.get(percent)
            return (
              <button
                key={label}
                type="button"
                disabled={Boolean(colorEditorProps)}
                aria-label={`${label} 색상 수정`}
                title={thresholdIndex === undefined ? `${label} 기본 색상을 새 설정으로 수정` : `${label} 색상 수정`}
                onClick={() => thresholdIndex === undefined
                  ? onAddColorThreshold({ thresholdPercent: percent, color, colorLabel: null })
                  : onEditColorThreshold(thresholdIndex)}
                style={{ backgroundColor: color }}
                className="flex h-7 w-full min-w-0 items-center justify-center border-0 p-0 text-white disabled:cursor-not-allowed"
              >
                <span className="text-xs font-bold leading-none whitespace-nowrap">{label}</span>
              </button>
            )
          })}
        </div>
        {colorEditorProps && (
          <p className="mt-1 text-xs text-gray-400">편집으로 비어진 부호의 기본 범례 칸은 숨깁니다.</p>
        )}
      </div>
      {colorEditorProps && (
        <div>
          <MarketMapColorThresholdEditorPanel {...colorEditorProps} />
        </div>
      )}
    </div>
  )
}

const STRONG_INDUSTRY_COLOR_OPTIONS = [
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
  return (
    <div className="pt-5 text-white">
      <p className="mb-3 flex items-center text-[15px]">
        <span className="settings-section-num">강조 색상</span>
        <SettingHelpIcon
          label="강조 색상"
          description={<>지도 내 업종명(1단계)과 <span className="inline-block whitespace-nowrap border-b border-current">1-4) 강세 업종 표시</span>의 색상을 설정합니다.</>}
        />
      </p>
      <div className="flex flex-wrap gap-1.5">
        {STRONG_INDUSTRY_COLOR_OPTIONS.map(option => (
          <span key={option.value} className="group relative inline-flex">
            <button
              type="button"
              aria-label={`${option.label} 색상 선택`}
              aria-pressed={color.toLowerCase() === option.value}
              onClick={() => onChange(option.value)}
              style={{ backgroundColor: option.value }}
              className={`h-6 w-6 rounded-full border-2 ${color.toLowerCase() === option.value ? 'border-white ring-1 ring-white/40' : 'border-transparent'}`}
            />
            <span
              role="tooltip"
              className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded border border-[#7a6d55] bg-[#fff8e7] px-2 py-1 text-xs text-black opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
            >
              {option.label}
            </span>
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-400">업종명과 강세 업종의 색상을 함께 변경합니다.</p>
    </div>
  )
}

interface Props {
  // 헤더에 "{pageLabel} 설정"으로 표시 — SubNavBar 탭 이름과 동일한 문구를 각 페이지가 그대로 넘겨준다.
  pageLabel: string
  sectionOrder?: readonly SettingsSidebarSectionId[]
  classificationAtBottom?: boolean
  // 사이드바 열림 상태는 페이지가 관리한다.
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  // 분류 체계 선택의 탭은 페이지가 정하고, 박스 크기 선택은 종목 표시 탭에 배치한다.
  classificationSection?: 'favorites' | 'industry'
  isCustom?: boolean
  onToggleCustom?: () => void
  avgChangeRateUseSimple?: boolean
  onToggleAvgChangeRateUseSimple?: () => void
  // 지도 페이지의 박스 면적 시가총액 반영 비율(0=동일 크기, 100=시가총액 비례).
  boxSizeMarketCapRatio?: number
  onChangeBoxSizeMarketCapRatio?: (value: number) => void
  // 지도 페이지의 현재/전체 종목 수를 제목 바로 옆에 표시한다.
  stockCountLabel?: string
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
  classificationSection = 'industry',
  isOpen,
  onOpenChange,
  isCustom,
  onToggleCustom,
  avgChangeRateUseSimple,
  onToggleAvgChangeRateUseSimple,
  boxSizeMarketCapRatio,
  onChangeBoxSizeMarketCapRatio,
  stockCountLabel,
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
  const hasStockSizeSelector = typeof avgChangeRateUseSimple === 'boolean' && Boolean(onToggleAvgChangeRateUseSimple)
  const hasBoxSizeRatioSlider = typeof boxSizeMarketCapRatio === 'number' && Boolean(onChangeBoxSizeMarketCapRatio)

  const availableSections = SETTINGS_SECTIONS.filter(section => sectionContent.has(section.id))
  if (sectionOrder) {
    availableSections.sort((a, b) => sectionOrder.indexOf(a.id) - sectionOrder.indexOf(b.id))
  }
  const selectedSection = availableSections.find(section => section.id === activeSection) ?? availableSections[0]
  const isNonScrollingSection = selectedSection?.id === 'favorites' ||
    (!classificationAtBottom && (selectedSection?.id === 'industry' || selectedSection?.id === 'colors'))

  // 닫혀있을 땐 아예 렌더링하지 않는다(트리거 버튼은 더 이상 이 컴포넌트가 아니라 호출부가 따로 그린다).
  if (!isOpen) return null

  return (
    <div
      className="tabular-nums flex w-72 shrink-0 flex-col overflow-hidden rounded-md border border-gray-500 bg-[#363639]"
      style={{ '--accent': '#d1d5db', '--accent-hover': '#f3f4f6', '--accent-light': '#d1d5db' } as CSSProperties}
    >
      <div className="flex shrink-0 items-center border-b border-gray-500 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <p className="flex h-7 items-center whitespace-nowrap text-lg font-bold leading-none text-white">{pageLabel} 설정</p>
          {stockCountLabel && (
            <span className="flex h-7 w-[7rem] shrink-0 items-center justify-end whitespace-nowrap text-right text-sm leading-none text-gray-400">
              {stockCountLabel}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onOpenChange(false)
          }}
          aria-label="닫기"
          className="ml-auto shrink-0 border-0 bg-transparent text-xl text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      {availableSections.length > 0 && (
      <nav role="tablist" aria-label={`${pageLabel} 설정 분류`} className="flex h-[68px] shrink-0 items-stretch border-b border-gray-500 bg-[#363639] px-1">
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
                onClick={() => setActiveSection(section.id)}
                className={`group relative box-border flex h-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-0 bg-transparent px-1 pt-2 pb-3 text-[11px] leading-tight transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--accent)] ${
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
      {selectedSection && (
        <div
          role="tabpanel"
          id={`settings-panel-${selectedSection.id}`}
          aria-labelledby={`settings-tab-${selectedSection.id}`}
          data-align-second-heading={classificationAtBottom || undefined}
          className={`settings-section-list settings-sidebar-tab-content min-h-0 flex-1 px-4 text-sm ${selectedSection.id === 'favorites' ? 'flex flex-col' : ''} ${
            isNonScrollingSection ? 'overflow-y-clip pb-2' : 'overflow-y-auto pb-8'
          }`}
        >
          <h2 className="mb-2 flex pt-4 pb-2 text-lg font-bold text-white">
            <span className="w-6 shrink-0 tabular-nums">
              {availableSections.findIndex(section => section.id === selectedSection.id) + 1}.
            </span>
            <span>{selectedSection.label}</span>
          </h2>
          {!classificationAtBottom && selectedSection.id === classificationSection && hasClassificationSelector && (
            <SettingsClassificationSelector isCustom={isCustom!} onToggleCustom={onToggleCustom!} />
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
          {sectionContent.get(selectedSection.id)?.map((content, index) => <Fragment key={index}>{content}</Fragment>)}
        </div>
      )}
      {classificationAtBottom && hasClassificationSelector && availableSections.length > 0 && (
        <SettingsClassificationSelector isCustom={isCustom!} onToggleCustom={onToggleCustom!} atBottom />
      )}
    </div>
  )
}
