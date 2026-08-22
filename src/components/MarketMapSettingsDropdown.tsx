import { useEffect, useRef, useState } from 'react'
import type { MarketValueTier } from '@/types/api'
import { MARKET_VALUE_TIER_OPTIONS } from '@/utils/marketValueTier'
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
  excludedMarketValueTiers: Set<MarketValueTier>
  onToggleMarketValueTier: (tier: MarketValueTier) => void
  onSelectAllMarketValueTiers: () => void
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

export default function MarketMapSettingsDropdown({
  isCustom,
  onToggleCustom,
  maxDepth,
  availableMaxDepth,
  onChangeMaxDepth,
  showMarketValue,
  onToggleShowMarketValue,
  excludedMarketValueTiers,
  onToggleMarketValueTier,
  onSelectAllMarketValueTiers,
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
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // 4개 구간을 전부 꺼버리면 마켓맵이 통째로 텅 비어서 의미가 없다 — 그래서 이 컨트롤은 되돌리는
  // 방향(전체 보기)만 원웨이로 제공하고, 개별 구간을 끄는 것과 반대로 한 번에 끄는 액션은 두지 않는다.
  const isAllTiersSelected = excludedMarketValueTiers.size === 0
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
          <ToggleSwitch checked={isCustom} onChange={onToggleCustom} label="개인 설정" />
          <div className="mt-6">
            <ToggleSwitch checked={showMarketValue} onChange={onToggleShowMarketValue} label="시가총액 표시" />
          </div>
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
          <div className="mt-6 text-white">
            <p className="font-bold">제외 설정</p>
            <div className="mt-3">
              <ToggleSwitch
                checked={isAllTiersSelected}
                onChange={onSelectAllMarketValueTiers}
                label="1. 시가총액 기준"
                disabled={isAllTiersSelected}
              />
              <div className="mt-2 flex flex-col gap-2 pl-2">
                {MARKET_VALUE_TIER_OPTIONS.map((opt, index) => (
                  <ToggleSwitch
                    key={opt.value}
                    checked={!excludedMarketValueTiers.has(opt.value)}
                    onChange={() => onToggleMarketValueTier(opt.value)}
                    label={`${index + 1}) ${opt.label}`}
                    hint={opt.range}
                  />
                ))}
              </div>
            </div>
            <div className="mt-4">
              <ToggleSwitch
                checked={sectorFilterEnabled}
                onChange={onToggleSectorFilter}
                label="2. 섹터 기준"
                disabled={!isCustom}
              />
              {isCustom && (
                <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto pl-2">
                  {excludedCategories.length === 0 ? (
                    <p className="text-[10.5px] text-gray-500">제외된 섹터 없음</p>
                  ) : (
                    excludedCategories.map((category, index) => (
                      <div key={category.categoryId} className="flex items-center justify-between gap-1 px-1 py-0.5">
                        <span className="min-w-0 truncate text-[10.5px] text-white">
                          {index + 1}) {category.categoryName}
                        </span>
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
