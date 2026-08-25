import { useEffect, useRef, useState } from 'react'
import { MARKET_VALUE_TIER_ASCENDING, MARKET_VALUE_TIER_SHORT_LABEL } from '@/utils/marketValueTier'
import { SettingsIcon } from '@/components/icons/MarketMapIcons'

interface ExcludedCategory {
  categoryId: number
  categoryName: string
}

interface Props {
  isCustom: boolean
  onToggleCustom: () => void
  // null이면 제한 없음(=availableMaxDepth 전체 다 보여줌). 슬라이더가 다룰 수 있는 실제 상한은
  // 지금 트리(exclude/tier 필터링까지 반영된)의 최대 뎁스라 따로 내려받는다.
  maxDepth: number | null
  availableMaxDepth: number
  onChangeMaxDepth: (value: number) => void
  // 셋 다 슬라이더 인덱스 기준(0=OFF, 1=뎁스0, 2=뎁스1, ...) — 실제 뎁스 범위로의 변환은 호출부(페이지) 책임.
  marketValueDepthMinIndex: number
  marketValueDepthMaxIndex: number
  onChangeMarketValueDepthRange: (minIndex: number, maxIndex: number) => void
  avgChangeRateDepthMinIndex: number
  avgChangeRateDepthMaxIndex: number
  onChangeAvgChangeRateDepthRange: (minIndex: number, maxIndex: number) => void
  upDownCountDepthMinIndex: number
  upDownCountDepthMaxIndex: number
  onChangeUpDownCountDepthRange: (minIndex: number, maxIndex: number) => void
  // MARKET_VALUE_TIER_ASCENDING(소→초) 기준 인덱스. 이 구간(포함) 밖의 시가총액 등급은 마켓맵에서 제외된다.
  tierRangeMinIndex: number
  tierRangeMaxIndex: number
  onChangeTierRange: (minIndex: number, maxIndex: number) => void
  // 개별 섹터를 켜고 끄는 토글이 아니라, "섹터 제외를 적용할지 말지" 자체를 한 번에 켜고 끄는 스위치.
  // 어떤 섹터를 제외 목록에 넣을지는 마켓맵에서 우클릭으로 추가/이 목록에서 X로 제거하는 것으로만 관리한다.
  sectorFilterEnabled: boolean
  onToggleSectorFilter: () => void
  excludedCategories: ExcludedCategory[]
  onRemoveExcludedCategory: (categoryId: number) => void
  compact?: boolean
}

// checked가 꺼지면 라벨 텍스트도 같이 옅어져서, 꺼져있다는 게 스위치 색뿐 아니라 글자로도 드러난다.
function ToggleSwitch({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean
  onChange: () => void
  label: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${disabled ? 'opacity-40' : ''}`}>
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className={`min-w-0 truncate ${checked ? 'text-white' : 'text-gray-500'}`}>{label}</span>
        {hint && <span className="shrink-0 text-[10.5px] text-gray-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        disabled={disabled}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#4f8fd6]' : 'bg-gray-600'} ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}

const TIER_STEPS = MARKET_VALUE_TIER_ASCENDING.length - 1

// 뎁스 범위 슬라이더의 맨 왼쪽 칸(인덱스 0)은 실제 뎁스가 아니라 OFF 자리 — 두 핸들이 전부 여기 있으면
// 완전히 꺼진 상태다. 그 오른쪽부터 1차 분류(뎁스0), 2차 분류(뎁스1), ...로 이어진다.
function depthRangeLabel(index: number): string {
  return index === 0 ? '끄기' : `${index}차 분류`
}

// 뎁스 범위 슬라이더 라벨(등락률/등락 종목수/시가총액 합)도 ToggleSwitch와 같은 방식으로
// OFF면 회색, 켜져있으면 흰색으로 표시한다.
function depthRangeSliderLabelClass(maxIndex: number): string {
  return maxIndex > 0 ? 'text-white' : 'text-gray-500'
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
  offIndex,
}: {
  minIndex: number
  maxIndex: number
  steps: number
  labels: string[]
  minAriaLabel: string
  maxAriaLabel: string
  onChange: (minIndex: number, maxIndex: number) => void
  disabled?: boolean
  // OFF 전용 칸의 인덱스(주로 0). 있으면: 드래그로는 이 칸에 들어가거나 나갈 수 없다(항상 offIndex+1
  // 이상만 드래그 가능) — OFF ↔ ON 전환은 아래 라벨 클릭으로만 한다.
  offIndex?: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const isOff = offIndex !== undefined && minIndex === offIndex && maxIndex === offIndex

  // 핸들 버튼은 순전히 시각적 표시일 뿐, 실제 클릭/드래그는 트랙 전체가 받는다 — 두 핸들이 겹치면
  // DOM상 나중에 그려지는 쪽(max)이 항상 클릭을 가로채 반대쪽 핸들을 못 잡는 문제를 이렇게 피한다.
  // 클릭 지점이 두 핸들의 중점보다 왼쪽이면 min을, 오른쪽이면 max를 그 위치로 옮긴다.
  //
  // offIndex가 있는 슬라이더(등락률/등락 종목수/시가총액 합)는 드래그와 클릭을 다르게 취급한다 —
  // 포인터가 실제로 움직였으면(threshold 이상) "드래그"로 보고 OFF 칸은 건드리지 않는 기존 범위
  // 조정만, 움직임 없이 그냥 뗐으면("클릭") OFF 칸을 클릭했으면 완전히 꺼짐, 다른 칸을 클릭했으면
  // 좌측은 첫 뎁스로 우측은 그 칸으로 한번에 점프 — 그래야 드래그만으로는 OFF에 들어가거나
  // 나갈 수 없으면서도(핸들끼리 서로 못 지나치는 규칙 때문에 트랩에 빠짐), 클릭 한 번으로 켜고 끌 수 있다.
  const CLICK_MOVE_THRESHOLD = 4
  const startDrag = (e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const rawIndexFromClientX = (clientX: number) => {
      const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0
      return Math.round(ratio * steps)
    }
    // OFF 칸으로는 드래그가 들어갈 수 없다 — 실제 뎁스값 중 최소인 offIndex+1이 바닥.
    const dragIndexFromClientX = (clientX: number) => {
      const index = rawIndexFromClientX(clientX)
      return offIndex !== undefined ? Math.max(index, offIndex + 1) : index
    }
    const which: 'min' | 'max' = dragIndexFromClientX(e.clientX) <= (minIndex + maxIndex) / 2 ? 'min' : 'max'
    const startX = e.clientX
    let dragged = false
    const handleMove = (ev: PointerEvent) => {
      if (!dragged && Math.abs(ev.clientX - startX) < CLICK_MOVE_THRESHOLD) return
      dragged = true
      if (offIndex !== undefined && isOff) return // OFF 상태에서는 드래그 자체가 무효
      const index = dragIndexFromClientX(ev.clientX)
      if (which === 'min') onChange(Math.min(index, maxIndex), maxIndex)
      else onChange(minIndex, Math.max(index, minIndex))
    }
    const handleUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
      if (dragged) return
      // 움직이지 않고 뗐다 = 클릭. offIndex가 없는(시가총액 구간) 슬라이더는 그냥 가까운 핸들을 그 자리로.
      if (offIndex === undefined) {
        const index = dragIndexFromClientX(ev.clientX)
        if (which === 'min') onChange(Math.min(index, maxIndex), maxIndex)
        else onChange(minIndex, Math.max(index, minIndex))
        return
      }
      const clickedIndex = rawIndexFromClientX(ev.clientX)
      if (clickedIndex === offIndex) {
        onChange(offIndex, offIndex) // OFF 클릭 → 항상 완전히 꺼짐
      } else if (isOff) {
        onChange(offIndex + 1, clickedIndex) // OFF에서 켜질 땐 좌측 첫 뎁스 + 클릭한 칸
      } else {
        // 이미 켜져있으면 더 가까운 핸들만 그 자리로 — 드래그와 동일하게 동작.
        const index = Math.max(clickedIndex, offIndex + 1)
        if (which === 'min') onChange(Math.min(index, maxIndex), maxIndex)
        else onChange(minIndex, Math.max(index, minIndex))
      }
    }
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
  }

  // 데이터가 얕아서 steps가 minIndex/maxIndex(기본값 등으로 미리 정해진 값)보다 작아질 수 있다 —
  // 그대로 두면 핸들이 트랙 밖(100% 너머)으로 밀려나므로 표시 위치만 안전하게 클램프한다.
  const minPct = (Math.min(minIndex, steps) / steps) * 100
  const maxPct = (Math.min(maxIndex, steps) / steps) * 100

  return (
    <div>
      <div
        ref={trackRef}
        className={`relative h-4 w-full ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onPointerDown={startDrag}
      >
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded bg-gray-600" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-[#4f8fd6]"
          style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
        />
        <div
          aria-label={minAriaLabel}
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full bg-[#4f8fd6]"
          style={{ left: `${minPct}%` }}
        />
        <div
          aria-label={maxAriaLabel}
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full bg-[#4f8fd6]"
          style={{ left: `${maxPct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-gray-400">
        {labels.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
    </div>
  )
}

export default function MarketMapSettingsDropdown({
  isCustom,
  onToggleCustom,
  maxDepth,
  availableMaxDepth,
  onChangeMaxDepth,
  marketValueDepthMinIndex,
  marketValueDepthMaxIndex,
  onChangeMarketValueDepthRange,
  avgChangeRateDepthMinIndex,
  avgChangeRateDepthMaxIndex,
  onChangeAvgChangeRateDepthRange,
  upDownCountDepthMinIndex,
  upDownCountDepthMaxIndex,
  onChangeUpDownCountDepthRange,
  tierRangeMinIndex,
  tierRangeMaxIndex,
  onChangeTierRange,
  sectorFilterEnabled,
  onToggleSectorFilter,
  excludedCategories,
  onRemoveExcludedCategory,
  compact = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const depthValue = Math.min(maxDepth ?? availableMaxDepth, availableMaxDepth)
  const isDepthDisabled = !isCustom || availableMaxDepth <= 1

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="설정"
        className={`flex items-center justify-center rounded text-gray-700 hover:bg-gray-100 hover:text-[#4f8fd6] ${compact ? 'p-1' : 'h-9 w-9'}`}
      >
        <SettingsIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 border border-gray-700 bg-[var(--surface)] p-4 text-left text-sm shadow-lg">
          <ToggleSwitch checked={isCustom} onChange={onToggleCustom} label="커스텀 모드" />
          <div className="mt-6 border-t border-gray-700 pt-4 text-white">
            <p className="font-bold">표시 범위</p>
            <div className={`mt-2 pl-2 text-xs ${isCustom ? '' : 'opacity-40'}`}>
              <span className="text-white">시가총액</span>
              <div className="mt-2">
                <RangeSlider
                  minIndex={tierRangeMinIndex}
                  maxIndex={tierRangeMaxIndex}
                  steps={TIER_STEPS}
                  labels={MARKET_VALUE_TIER_ASCENDING.map(tier => MARKET_VALUE_TIER_SHORT_LABEL[tier])}
                  minAriaLabel="최소 시가총액 구간"
                  maxAriaLabel="최대 시가총액 구간"
                  onChange={onChangeTierRange}
                  disabled={!isCustom}
                />
              </div>
            </div>
            <div className={`mt-3 flex items-center gap-2 pl-2 text-xs ${isDepthDisabled ? 'opacity-40' : ''}`}>
              <span className="shrink-0 text-white">분류 차수 범위</span>
              <span className="shrink-0 text-gray-400">
                {depthValue}/{availableMaxDepth}
              </span>
              <input
                type="range"
                min={1}
                max={availableMaxDepth}
                value={depthValue}
                onChange={e => onChangeMaxDepth(Number(e.target.value))}
                disabled={isDepthDisabled}
                className="min-w-0 flex-1 accent-[#4f8fd6] disabled:cursor-not-allowed"
              />
            </div>
            <div className={`mt-3 pl-2 text-xs ${isCustom ? '' : 'opacity-40'}`}>
              <span className={depthRangeSliderLabelClass(avgChangeRateDepthMaxIndex)}>등락률</span>
              <div className="mt-2">
                <RangeSlider
                  minIndex={avgChangeRateDepthMinIndex}
                  maxIndex={avgChangeRateDepthMaxIndex}
                  steps={availableMaxDepth}
                  labels={Array.from({ length: availableMaxDepth + 1 }, (_, index) => depthRangeLabel(index))}
                  minAriaLabel="최소 등락률 표시 뎁스"
                  offIndex={0}
                  maxAriaLabel="최대 등락률 표시 뎁스"
                  onChange={onChangeAvgChangeRateDepthRange}
                  disabled={!isCustom}
                />
              </div>
            </div>
            <div className={`mt-3 pl-2 text-xs ${isCustom ? '' : 'opacity-40'}`}>
              <span className={depthRangeSliderLabelClass(upDownCountDepthMaxIndex)}>등락 종목수</span>
              <div className="mt-2">
                <RangeSlider
                  minIndex={upDownCountDepthMinIndex}
                  maxIndex={upDownCountDepthMaxIndex}
                  steps={availableMaxDepth}
                  labels={Array.from({ length: availableMaxDepth + 1 }, (_, index) => depthRangeLabel(index))}
                  minAriaLabel="최소 등락 종목수 표시 뎁스"
                  offIndex={0}
                  maxAriaLabel="최대 등락 종목수 표시 뎁스"
                  onChange={onChangeUpDownCountDepthRange}
                  disabled={!isCustom}
                />
              </div>
            </div>
            <div className={`mt-3 pl-2 text-xs ${isCustom ? '' : 'opacity-40'}`}>
              <span className={depthRangeSliderLabelClass(marketValueDepthMaxIndex)}>시가총액 합</span>
              <div className="mt-2">
                <RangeSlider
                  minIndex={marketValueDepthMinIndex}
                  maxIndex={marketValueDepthMaxIndex}
                  steps={availableMaxDepth}
                  labels={Array.from({ length: availableMaxDepth + 1 }, (_, index) => depthRangeLabel(index))}
                  minAriaLabel="최소 시가총액 합 표시 뎁스"
                  offIndex={0}
                  maxAriaLabel="최대 시가총액 합 표시 뎁스"
                  onChange={onChangeMarketValueDepthRange}
                  disabled={!isCustom}
                />
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-gray-700 pt-4 text-white">
            <p className="font-bold">제외 설정</p>
            <div className="mt-3 text-xs">
              <ToggleSwitch
                checked={sectorFilterEnabled}
                onChange={onToggleSectorFilter}
                label="섹터 기준"
                disabled={!isCustom}
              />
              {isCustom && (
                <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto pl-2">
                  {excludedCategories.length === 0 ? (
                    <p className="text-[10.5px] text-gray-500">제외된 섹터 없음</p>
                  ) : (
                    excludedCategories.map(category => (
                      <div key={category.categoryId} className="flex items-center justify-between gap-1 px-1 py-0.5">
                        <span className="min-w-0 truncate text-[10.5px] text-white">{category.categoryName}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveExcludedCategory(category.categoryId)}
                          className="shrink-0 border-0 bg-transparent text-red-500 hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
