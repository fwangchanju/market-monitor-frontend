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
  showMarketValue: boolean
  onToggleShowMarketValue: () => void
  showAvgChangeRate: boolean
  onToggleShowAvgChangeRate: () => void
  showUpDownCount: boolean
  onToggleShowUpDownCount: () => void
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

// 양쪽 끝에 핸들이 있으면 전체(소~초) 다 보여주고, 핸들을 안쪽으로 옮기면 그 구간(포함) 밖의
// 등급은 마켓맵에서 제외된다. 두 핸들은 서로를 지나칠 수 없다(겹치는 건 허용 — 그러면 그 한 등급만 표시).
function MarketValueRangeSlider({
  minIndex,
  maxIndex,
  onChange,
  disabled = false,
}: {
  minIndex: number
  maxIndex: number
  onChange: (minIndex: number, maxIndex: number) => void
  disabled?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  // 핸들 버튼은 순전히 시각적 표시일 뿐, 실제 클릭/드래그는 트랙 전체가 받는다 — 두 핸들이 겹치면
  // DOM상 나중에 그려지는 쪽(max)이 항상 클릭을 가로채 반대쪽 핸들을 못 잡는 문제를 이렇게 피한다.
  // 클릭 지점이 두 핸들의 중점보다 왼쪽이면 min을, 오른쪽이면 max를 그 위치로 옮긴다.
  const startDrag = (e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    const track = trackRef.current
    if (!track) return
    const indexFromClientX = (clientX: number) => {
      const rect = track.getBoundingClientRect()
      const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0
      return Math.round(ratio * TIER_STEPS)
    }
    const which: 'min' | 'max' = indexFromClientX(e.clientX) <= (minIndex + maxIndex) / 2 ? 'min' : 'max'
    const move = (clientX: number) => {
      const index = indexFromClientX(clientX)
      if (which === 'min') onChange(Math.min(index, maxIndex), maxIndex)
      else onChange(minIndex, Math.max(index, minIndex))
    }
    move(e.clientX)
    const handleMove = (ev: PointerEvent) => move(ev.clientX)
    const handleUp = () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
    }
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
  }

  const minPct = (minIndex / TIER_STEPS) * 100
  const maxPct = (maxIndex / TIER_STEPS) * 100

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
          aria-label="최소 시가총액 구간"
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full bg-[#4f8fd6]"
          style={{ left: `${minPct}%` }}
        />
        <div
          aria-label="최대 시가총액 구간"
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full bg-[#4f8fd6]"
          style={{ left: `${maxPct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-gray-400">
        {MARKET_VALUE_TIER_ASCENDING.map(tier => (
          <span key={tier}>{MARKET_VALUE_TIER_SHORT_LABEL[tier]}</span>
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
  showMarketValue,
  onToggleShowMarketValue,
  showAvgChangeRate,
  onToggleShowAvgChangeRate,
  showUpDownCount,
  onToggleShowUpDownCount,
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
          <ToggleSwitch checked={isCustom} onChange={onToggleCustom} label="개인 설정 모드" />
          <div className={`mt-6 flex items-center justify-between gap-2 ${isDepthDisabled ? 'opacity-40' : ''}`}>
            <span className="shrink-0 text-white">분류 단계</span>
            <div className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-right text-gray-400">
                {depthValue}/{availableMaxDepth}
              </span>
              <input
                type="range"
                min={1}
                max={availableMaxDepth}
                value={depthValue}
                onChange={e => onChangeMaxDepth(Number(e.target.value))}
                disabled={isDepthDisabled}
                className="w-20 accent-[#4f8fd6] disabled:cursor-not-allowed"
              />
            </div>
          </div>
          <div className="mt-6 border-t border-gray-700 pt-4 text-white">
            <p className="font-bold">표시 설정</p>
            <div className={`mt-2 pl-2 ${isCustom ? '' : 'opacity-40'}`}>
              <span className="text-white">시가총액 구간</span>
              <div className="mt-2">
                <MarketValueRangeSlider
                  minIndex={tierRangeMinIndex}
                  maxIndex={tierRangeMaxIndex}
                  onChange={onChangeTierRange}
                  disabled={!isCustom}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 pl-2">
              <ToggleSwitch checked={showMarketValue} onChange={onToggleShowMarketValue} label="시가총액 합" />
              <ToggleSwitch checked={showAvgChangeRate} onChange={onToggleShowAvgChangeRate} label="등락률 평균" />
              <ToggleSwitch checked={showUpDownCount} onChange={onToggleShowUpDownCount} label="등락 종목수" />
            </div>
          </div>
          <div className="mt-6 border-t border-gray-700 pt-4 text-white">
            <p className="font-bold">제외 설정</p>
            <div className="mt-3">
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
