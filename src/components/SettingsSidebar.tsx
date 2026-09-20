import { useRef, type ReactNode } from 'react'
import { useIsAdmin } from '@/hooks/useAccess'
import type { DepthMetric } from '@/hooks/useGlobalSettings'
import type { ColorScaleConfig, ColorScaleThreshold, LegendSwatch } from '@/utils/marketMapColorScale'
import { FONT_BAR_LEGEND } from '@/components/FontStyle'
import type { MarketValueTierItem } from '@/types/api'

interface ExcludedCategory {
  categoryId: number
  categoryName: string
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
  compact = false,
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
        className={`relative shrink-0 rounded-full transition-colors ${compact ? 'h-4 w-7' : 'h-5 w-9'} ${checked ? 'bg-[var(--accent)]' : 'bg-gray-600'} ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 rounded-full bg-white transition-transform ${compact ? 'h-3 w-3' : 'h-4 w-4'} ${checked ? (compact ? 'translate-x-3' : 'translate-x-4') : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}

// 뎁스 범위 슬라이더 인덱스는 뎁스에 직접 대응한다(0=대분류, 1=중분류, 2=소분류, ...).
const DEPTH_LABELS = ['대분류', '중분류', '소분류']

// 선호 업종으로 강조할 상위 카테고리 수 — 0은 끄기.
const TOP_PICK_COUNT_LABELS = ['끄기', '1개', '2개', '3개']

// 등락률/등락 종목수/시가총액 합 중 하나만 라디오처럼 고른다 — 순서가 곧 라벨 표시 순서.
const DEPTH_METRIC_OPTIONS: { key: DepthMetric; label: string }[] = [
  { key: 'avgChangeRate', label: '등락률' },
  { key: 'upDownCount', label: '등락 종목수' },
  { key: 'marketValue', label: '시가총액 합' },
]

// 종목 박스 표시 내용 슬라이더 라벨 — 인덱스가 곧 STOCK_LABEL_MODES(useGlobalSettings)의 인덱스.
const STOCK_LABEL_MODE_LABELS = ['끄기', '종목명', '등락률', '모두']

// 등락률 소수점 슬라이더 라벨 — 인덱스 그대로 소수점 자릿수(toPctSigned의 decimalPlaces 인자, 0=정수).
const DECIMAL_PLACES_LABELS = ['정수', '1자리', '2자리']

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
}) {
  const trackRef = useRef<HTMLDivElement>(null)
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
    if (disabled) return
    e.preventDefault()
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const rawIndexFromClientX = (clientX: number) => {
      const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0
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
  const labelSteps = Math.max(labels.length - 1, 1)

  return (
    <div>
      <div
        ref={trackRef}
        className={`relative h-4 w-full ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onPointerDown={startDrag}
      >
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded bg-gray-600" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-[var(--accent)]"
          style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
        />
        <div
          aria-label={minAriaLabel}
          className="pointer-events-none absolute top-1/2 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center touch-none text-[var(--accent)] text-sm font-bold leading-none"
          style={{ left: `${minPct}%` }}
        >
          ←
        </div>
        <div
          aria-label={maxAriaLabel}
          className="pointer-events-none absolute top-1/2 z-20 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center touch-none text-[var(--accent)] text-sm font-bold leading-none"
          style={{ left: `${maxPct}%` }}
        >
          →
        </div>
      </div>
      {/* 라벨 개수(=steps+1)가 슬라이더마다 다르므로, flex justify-between 대신 핸들과 똑같은 방식
          (각 tick의 x% 위치에 중심을 맞춰 절대 위치)으로 배치해야 라벨 중앙이 항상 그 tick과 정확히
          x축이 맞는다 — 라벨 폭이 서로 달라도(예: "끄기" vs "중분류") 흔들리지 않는다. */}
      <div className="relative mt-1 h-4 text-xs text-gray-400">
        {labels.map((label, index) => (
          <span
            key={index}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${(index / labelSteps) * 100}%` }}
          >
            {label}
          </span>
        ))}
      </div>
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
      <div className="relative mt-1 h-4 text-xs text-gray-400">
        {labels.map((label, labelIndex) => (
          <span
            key={label}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${(labelIndex / steps) * 100}%` }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function colorThresholdLabel(threshold: ColorScaleThreshold): string {
  if (threshold.thresholdPercent === 0) return '0% (기준)'
  return `${threshold.thresholdPercent > 0 ? '+' : ''}${threshold.thresholdPercent}%`
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
    <div className="sticky top-0 z-10 -mx-4 border-b border-gray-700 bg-zinc-800 px-4 pt-4 pb-3">
      <ToggleSwitch
        checked={isCustom}
        onChange={onToggleCustom}
        label="커스텀 모드"
        labelClassName="text-base settings-section-bullet"
        labelSuffix={stockCountLabel ? <span className="text-sm text-gray-400">{stockCountLabel}</span> : undefined}
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
      labelSuffix={<span className="text-gray-500">↔ {avgChangeRateUseSimple ? '시총 가중' : '동일 가중'}</span>}
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

export function SettingsCategoryLevelSection({
  isCustom,
  maxDepth,
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
  topPickMaxSelectableDepth,
  onChangeTopPickDepth,
  onChangeTopPickCount,
  stockLabelModeIndex,
  onChangeStockLabelModeIndex,
  boxLabelMinAreaPercent,
  onChangeBoxLabelMinAreaPercent,
  decimalPlacesIndex,
  onChangeDecimalPlacesIndex,
  showTopPick = false,
  showDecimalPlaces = false,
  showDivider = true,
}: {
  isCustom: boolean
  // "업종 분류 탭" 위에 구분선(border-t)을 그릴지 — 스티키 커스텀모드 블록(또는 동일 가중) 바로 다음에
  // 올 때는 그 자체로 이미 구분되므로 false로 끈다. "종목 박스"는 "업종 분류 탭" 바로 다음이라 항상 그린다.
  showDivider?: boolean
  // null이면 제한 없음(=availableMaxDepth 전체 다 보여줌). 슬라이더가 다룰 수 있는 실제 상한은
  // 지금 트리(exclude/tier 필터링까지 반영된)의 최대 뎁스라 따로 내려받는다.
  maxDepth: number | null
  availableMaxDepth: number
  onChangeMaxDepth: (value: number) => void
  // 등락률/등락 종목수/시가총액 합 중 하나만 라디오처럼 고른다 — 표시 여부는 별도 토글로 제어한다.
  activeDepthMetric: DepthMetric
  onChangeActiveDepthMetric: (metric: DepthMetric) => void
  // 업종 표시 지표 전체의 표시 여부 — 라디오 선택과 범위 조정은 이 토글이 켜져 있을 때만 가능하다.
  depthMetricEnabled: boolean
  onToggleDepthMetric: () => void
  // 인덱스는 뎁스에 직접 대응(0=대분류, 1=중분류, ...) — 위에서 고른 지표 하나에 공통으로 적용된다.
  depthMetricMinIndex: number
  depthMetricMaxIndex: number
  onChangeDepthMetricRange: (minIndex: number, maxIndex: number) => void
  // 선호 업종의 절대 depth/상위 N개 — 지도 페이지에서만 showTopPick으로 노출한다.
  topPickDepth: number
  topPickCount: number
  topPickMaxSelectableDepth: number
  onChangeTopPickDepth: (depth: number) => void
  onChangeTopPickCount: (count: number) => void
  // 종목 박스에 끄기(0)/이름만(1)/등락률만(2)/둘 다(3) 보여줄지 — STOCK_LABEL_MODE_OPTIONS 인덱스.
  stockLabelModeIndex: number
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
}) {
  // 설정에서 선택할 수 있는 최소 단계는 대/중/소분류까지 보장한다. 실제 데이터가 얕으면 해당 단계의
  // 화면 결과만 비어 있을 뿐, 사용자가 미리 설정해 둔 값을 UI가 임의로 막거나 지우지는 않는다.
  const depthLabelCount = Math.max(availableMaxDepth, DEPTH_LABELS.length)
  const depthValue = Math.min(maxDepth ?? depthLabelCount, depthLabelCount)
  const isDepthDisabled = !isCustom || availableMaxDepth <= 1
  const depthMetricMaxSelectableIndex = Math.max(0, Math.min(depthLabelCount, maxDepth ?? depthLabelCount) - 1)
  const isDepthMetricDisabled = !isCustom || maxDepth === 0
  const isTopPickDisabled = !isCustom || maxDepth === 0
  const depthMetricLabels = Array.from({ length: depthLabelCount }, (_, index) => DEPTH_LABELS[index] ?? `${index + 1}차 분류`)
  // 업종 분류 레벨은 maxDepth(0=끄기, 1=대분류까지, ...)를 인덱스 그대로 쓰므로 맨 앞에 "끄기" 칸이 있어야
  // 소분류(3)까지 갈 수 있다. 지표 범위 슬라이더는 뎁스 인덱스(0=대분류)라 "끄기" 칸이 없다.
  const depthLevelLabels = ['끄기', ...depthMetricLabels]
  const depthMetricSliderSteps = Math.max(depthLabelCount - 1, 1)
  // 선택값은 저장한 범위를 그대로 유지하되, 현재 업종 분류 레벨을 넘는 부분만 화면에서 잘라 보여준다.
  const depthMetricSliderMinIndex = Math.min(depthMetricMinIndex, depthMetricMaxSelectableIndex)
  const depthMetricSliderMaxIndex = Math.min(depthMetricMaxIndex, depthMetricMaxSelectableIndex)

  return (
    <div className="text-white">
      {/* 구분선(border-t)은 항상 "다음에 오는 섹션"이 자기 앞에 그린다 — 앞 섹션이 border-b를 겹쳐
          그리면 두 섹션이 바뀔 때(페이지마다 순서가 다름) 구분선이 두 줄이 되거나 아예 없어지는
          문제가 있었다. showDivider=false는 바로 위가 스티키 커스텀모드 블록(또는 동일 가중)이라
          이미 그 자체로 구분되는 경우에만 쓴다. */}
      <div className={showDivider ? 'mt-6 border-t border-gray-700 pt-8' : 'pt-8'}>
        <p className="settings-section-num text-base">업종 분류 탭</p>
        <div className="settings-subsection-list">
          <div className={`mt-2 pl-2 text-sm ${isDepthDisabled ? 'opacity-40' : ''}`}>
            {/* "끄기/대분류/중분류/소분류..." 눈금 라벨을 슬라이더 하단에 둔다 — 끄기(0)는 카테고리
                태그를 평탄화하고, 실제 화면에 표시할 최대 분류 레벨은 이 값을 기준으로 제한한다. */}
            <span className="settings-subsection-num block max-w-[16rem] text-left text-white">업종 분류 레벨</span>
            <div className="mt-2 max-w-[16rem]">
              <SingleValueSlider
                index={depthValue}
                labels={depthLevelLabels}
                ariaLabel="업종 분류 레벨"
                onChange={onChangeMaxDepth}
                disabled={isDepthDisabled}
              />
            </div>
          </div>
          <div className={`mt-3 pl-2 text-sm ${isDepthMetricDisabled ? 'opacity-40' : ''}`}>
            <div className="flex max-w-[16rem] items-center justify-between">
              <span className="settings-subsection-num block text-left text-white">업종 표시 지표</span>
              <ToggleSwitch
                checked={depthMetricEnabled}
                onChange={onToggleDepthMetric}
                label="업종 표시 지표 사용"
                hideLabel
                compact
                disabled={isDepthMetricDisabled}
              />
            </div>
            <div className={`mt-2 pl-2 ${depthMetricEnabled ? '' : 'opacity-40'}`}>
              {/* 세 선택지는 지표를 고르는 라디오 그룹일 뿐, 기능을 켜고 끄지는 않는다. 활성화는 제목 옆
                  작은 토글만 담당하므로 토글이 꺼진 동안 라디오를 눌러도 화면에 다시 나타나지 않는다. */}
              <div role="radiogroup" aria-label="업종 표시 지표" className="flex max-w-[16rem] flex-row items-center gap-3 whitespace-nowrap">
                {DEPTH_METRIC_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={activeDepthMetric === opt.key}
                    onClick={() => onChangeActiveDepthMetric(opt.key)}
                    disabled={isDepthMetricDisabled || !depthMetricEnabled}
                    className={`border-0 bg-transparent p-0 text-left disabled:cursor-not-allowed ${
                      activeDepthMetric === opt.key ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 max-w-[16rem]">
                <RangeSlider
                  minIndex={depthMetricSliderMinIndex}
                  maxIndex={depthMetricSliderMaxIndex}
                  steps={depthMetricSliderSteps}
                  labels={depthMetricLabels}
                  minAriaLabel="최소 표시 뎁스"
                  maxAriaLabel="최대 표시 뎁스"
                  maxSelectableIndex={depthMetricMaxSelectableIndex}
                  onChange={onChangeDepthMetricRange}
                  disabled={isDepthMetricDisabled || !depthMetricEnabled}
                />
              </div>
            </div>
          </div>
          {showTopPick && (
            <div className={`mt-3 pl-2 text-sm ${isTopPickDisabled ? 'opacity-40' : ''}`}>
              <span className="settings-subsection-num block max-w-[16rem] text-left text-white">강세 업종 표시</span>
              <div
                role="radiogroup"
                aria-label="강세 업종 표시 분류 단계"
                className="mt-2 flex max-w-[16rem] flex-row items-center gap-3 whitespace-nowrap"
              >
                {DEPTH_LABELS.map((label, index) => {
                  const isOptionDisabled = isTopPickDisabled || index >= topPickMaxSelectableDepth
                  return (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={topPickDepth === index}
                      onClick={() => onChangeTopPickDepth(index)}
                      disabled={isOptionDisabled}
                      className={`border-0 bg-transparent p-0 text-left disabled:cursor-not-allowed ${
                        topPickDepth === index ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-2 max-w-[16rem]">
                <SingleValueSlider
                  index={topPickCount}
                  labels={TOP_PICK_COUNT_LABELS}
                  ariaLabel="강세 업종 표시 개수"
                  onChange={onChangeTopPickCount}
                  disabled={isTopPickDisabled}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      {/* "종목 박스" 중제목 — "종목 박스 표기", "종목 텍스트 표시 기준", (지도 페이지 한정) "등락률
          소수점"을 하위 속성으로 묶는다. "업종 분류 탭" 바로 다음이라 구분선은 항상 그린다. */}
      <div className="mt-6 border-t border-gray-700 pt-8">
        <p className="settings-section-num text-base">종목 박스</p>
        <div className="settings-subsection-list">
          <div className={`mt-2 pl-2 text-sm ${isCustom ? '' : 'opacity-40'}`}>
            <span className="settings-subsection-num block max-w-[16rem] text-left text-white">종목 박스 내 표기</span>
            <div className="mt-2 max-w-[16rem]">
              <SingleValueSlider
                index={stockLabelModeIndex}
                labels={STOCK_LABEL_MODE_LABELS}
                ariaLabel="종목 박스 내 표기"
                onChange={onChangeStockLabelModeIndex}
                disabled={!isCustom}
              />
            </div>
          </div>
          <div className={`mt-3 pl-2 text-sm ${isCustom ? '' : 'opacity-40'}`}>
            {/* 퍼센티지 값은 우측 끝에 옅은 회색으로 — 그 값이 없다고 치면 라벨만 가운데 정렬된 것처럼
                보이도록, 라벨을 flex-1로 남는 공간에서 가운데 정렬한다("업종 분류 레벨" + N/M 배지와
                동일한 패턴). 값 변경은 아래 슬라이더로만 한다. */}
            <div className="flex max-w-[16rem] items-center">
              <span className="settings-subsection-num flex-1 text-left text-white">종목 박스 내 텍스트 표시 유무</span>
              <span className="text-gray-400">{boxLabelMinAreaPercent.toFixed(2)}%</span>
            </div>
            <div className="mt-2 max-w-[16rem]">
              <input
                type="range"
                min={0.01}
                max={0.3}
                step={0.01}
                value={boxLabelMinAreaPercent}
                onChange={e => onChangeBoxLabelMinAreaPercent(Number(e.target.value))}
                disabled={!isCustom}
                className="w-full accent-[var(--accent)] disabled:cursor-not-allowed"
              />
            </div>
          </div>
          {showDecimalPlaces && (
            <div className={`mt-3 pl-2 text-sm ${isCustom ? '' : 'opacity-40'}`}>
              <span className="settings-subsection-num block max-w-[16rem] text-left text-white">등락률 소수점 자릿수</span>
              <div className="mt-2 max-w-[16rem]">
                <SingleValueSlider
                  index={decimalPlacesIndex}
                  labels={DECIMAL_PLACES_LABELS}
                  ariaLabel="등락률 소수점 자릿수"
                  onChange={onChangeDecimalPlacesIndex}
                  disabled={!isCustom}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function SettingsMarketValueSection({
  isCustom,
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
  // 그릴 때만 좌우를 뒤집는다(초대형주가 왼쪽) — 저장값/다른 화면(카테고리 랭킹)과 공유하는 인덱스
  // 의미는 안 바뀐다.
  const tierSteps = Math.max(tiers.length - 1, 1)
  const tierDisplayLabels = [...tiers].reverse().map(tier => tier.label)
  const tierDisplayMinIndex = tierSteps - tierRangeMaxIndex
  const tierDisplayMaxIndex = tierSteps - tierRangeMinIndex

  return (
    <div className={showDivider ? 'mt-6 border-t border-gray-700 pt-8 text-white' : 'pt-8 text-white'}>
      <p className="settings-section-num text-base">종목 표시 범위</p>
      <div className={`settings-subsection-list mt-2 pl-2 text-sm ${isCustom ? '' : 'opacity-40'}`}>
        <span className="settings-subsection-num block max-w-[16rem] text-left text-white">시가총액</span>
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
            disabled={!isCustom || tiers.length === 0}
          />
        </div>
      </div>
    </div>
  )
}

export function SettingsExcludeSection({
  isCustom,
  sectorFilterEnabled,
  onToggleSectorFilter,
  excludedCategories,
  onRemoveExcludedCategory,
}: {
  isCustom: boolean
  // 개별 섹터를 켜고 끄는 토글이 아니라, "섹터 제외를 적용할지 말지" 자체를 한 번에 켜고 끄는 스위치.
  // 어떤 섹터를 제외 목록에 넣을지는 마켓맵에서 우클릭으로 추가/이 목록에서 X로 제거하는 것으로만 관리한다.
  sectorFilterEnabled: boolean
  onToggleSectorFilter: () => void
  excludedCategories: ExcludedCategory[]
  onRemoveExcludedCategory: (categoryId: number) => void
}) {
  return (
    <div className="mt-6 border-t border-gray-700 pt-8 text-white">
      <div className="text-sm">
        <ToggleSwitch
          checked={sectorFilterEnabled}
          onChange={onToggleSectorFilter}
          label="종목 제외 범위"
          labelClassName="text-base settings-section-num"
          disabled={!isCustom}
        />
        {isCustom && (
          <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto pl-2">
            {excludedCategories.length === 0 ? (
              <p className="text-xs text-gray-500">제외된 범위 없음</p>
            ) : (
              excludedCategories.map(category => (
                <div key={category.categoryId} className="flex items-center gap-1.5 px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`${category.categoryName}\n제외 목록에서 삭제하시겠습니까?`)) return
                      onRemoveExcludedCategory(category.categoryId)
                    }}
                    className="shrink-0 border-0 bg-transparent text-red-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                  <span className="min-w-0 truncate text-xs text-white">{category.categoryName}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function SettingsColorSection({
  isCustom,
  colorScaleDraft,
  colorCustomOn,
  onChangeColorCustomOn,
  onEditColorThreshold,
  onDeleteColorThreshold,
  legendSwatches,
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
  // 추가/수정은 이 팝업이 아니라 좌측 필터 바 하단 패널(MarketMapColorThresholdEditorPanel)에서 진행된다
  // — 이 팝업은 그 세션이 시작되면(onAddColorThreshold/onEditColorThreshold) 잠깐 닫히고, 세션이
  // 끝나면(적용/취소) 페이지가 다시 열어준다. 저장은 그 패널의 "적용"과 이 팝업의 삭제-확인이 각자
  // 알아서 하므로 이 팝업 자체엔 더 이상 "저장" 버튼이 없다.
  onEditColorThreshold: (index: number) => void
  onDeleteColorThreshold: (index: number) => void
  // 지도 상단 바에 있던 범례를 이 섹션으로 옮겨왔다 — resolveMarketMapColor와 동일한 함수를 거쳐
  // 나온 값이라 실제 박스 색칠과 항상 일치한다(useGlobalSettings의 settingsModalProps에 포함).
  legendSwatches: LegendSwatch[]
}) {
  const isAdmin = useIsAdmin()
  if (!isAdmin || colorScaleDraft === null) return null

  const sortedColorThresholds = colorScaleDraft.thresholds
    .map((threshold, index) => ({ threshold, index }))
    .sort((a, b) => b.threshold.thresholdPercent - a.threshold.thresholdPercent)

  return (
    <div className="mt-6 border-t border-gray-700 pt-8 text-white">
      {/* "색상 커스텀 모드" 토글을 별도 줄로 두지 않고, 제목("색상 범위") 바로 우측에 스위치만 붙인다. */}
      <div className="flex items-center justify-between">
        <p className="settings-section-num text-base">색상 범위</p>
        <ToggleSwitch
          checked={colorCustomOn}
          onChange={() => onChangeColorCustomOn(!colorCustomOn)}
          label="색상 범위 커스텀"
          disabled={!isCustom}
          hideLabel
        />
      </div>
      <div className={`mt-3 flex flex-col gap-1 text-sm ${isCustom && colorCustomOn ? '' : 'pointer-events-none opacity-40'}`}>
        {/* 지도 상단 바에 있던 범례 — 사이드바 폭에 맞춰 필요하면 다음 줄로 넘어간다(원래 바는
            한 줄 고정폭이었지만 여기선 폭이 더 좁아 넘칠 수 있음). */}
        <div className="flex flex-wrap gap-0.5">
          {legendSwatches.map(({ label, color }) => (
            <div key={label} style={{ backgroundColor: color }} className="flex h-6 w-9 shrink-0 items-center justify-center">
              <span className={FONT_BAR_LEGEND}>{label}</span>
            </div>
          ))}
        </div>
        {sortedColorThresholds.length === 0 ? (
          <p className="px-2 py-1 text-gray-500">설정된 값이 없습니다</p>
        ) : (
          sortedColorThresholds.map(({ threshold, index }) => (
            <div key={index} className="group flex items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-white/5">
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 shrink-0 rounded border border-gray-600" style={{ backgroundColor: threshold.color }} />
                <span className="text-white">{colorThresholdLabel(threshold)}</span>
              </div>
              <div className="hidden items-center gap-3 group-hover:flex">
                <button
                  type="button"
                  onClick={() => onEditColorThreshold(index)}
                  className="border-0 bg-transparent text-xs text-white hover:text-[var(--accent)]"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteColorThreshold(index)}
                  className="border-0 bg-transparent text-xs text-red-500 hover:text-red-400"
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

interface Props {
  // 헤더에 "{pageLabel} 설정"으로 표시 — SubNavBar 탭 이름과 동일한 문구를 각 페이지가 그대로 넘겨준다.
  pageLabel: string
  // 사이드바 열림 상태를 페이지가 들고 있어야 색상 편집 세션 전환(잠깐 닫혔다가 다시 열리는 것)이 가능하다.
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  // 실제로 보여줄 옵션 섹션들 — 페이지가 자기한테 유효한 Settings*Section만 골라 조립한다.
  // 아무것도 안 넘기면(요약/어드민처럼 이 설정이 전혀 적용 안 되는 페이지) 헤더만 있는 빈 사이드바가 된다.
  children?: ReactNode
}

// 팝업이 아니라 실제 렌더링 영역을 왼쪽으로 밀어내는 도킹형 사이드바 — 헤더 + 스크롤 바디만 그리는
// 껍데기고, 실제 옵션 내용은 전부 위 Settings*Section들을 children으로 조립해서 채운다.
export default function SettingsSidebar({ pageLabel, isOpen, onOpenChange, children }: Props) {
  // 닫혀있을 땐 아예 렌더링하지 않는다(트리거 버튼은 더 이상 이 컴포넌트가 아니라 호출부가 따로 그린다).
  if (!isOpen) return null

  return (
    // 슬라이더 자체 폭(max-w-[16rem])의 약 1.3배 — 실제 지도 너비를 덜 뺏도록 사이드바를 좁게 유지한다.
    <div className="flex w-80 shrink-0 flex-col overflow-hidden border border-gray-700 bg-zinc-800">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-700 p-4">
        <p className="flex h-7 items-center text-lg font-bold leading-none text-white">{pageLabel} 설정</p>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="닫기"
          className="border-0 bg-transparent text-xl text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="settings-section-list min-h-0 flex-1 overflow-y-auto px-4 pb-8 text-sm">{children}</div>
    </div>
  )
}
