import { useState } from 'react'
import NavBar from '@/components/NavBar'
import TabSelector from '@/components/TabSelector'
import MarketMapTreemap from '@/components/MarketMapTreemap'
import MarketMapManageSidebar from '@/components/MarketMapManageSidebar'
import { useMarketMap } from '@/hooks/useMarketMap'
import { toDateTimeLabel } from '@/utils/format'
import { MarketSchema, type Market } from '@/types/api'

const MARKETS = MarketSchema.options

type ExcludeToggle = 'EXCLUDE' | 'ALL'
const EXCLUDE_TOGGLES: ExcludeToggle[] = ['EXCLUDE', 'ALL']
const excludeToggleLabel = (t: ExcludeToggle) => (t === 'EXCLUDE' ? '대형주 제외' : '전체')

export default function MarketMapPage() {
  const [market, setMarket] = useState<Market>('KOSPI')
  const [excludeToggle, setExcludeToggle] = useState<ExcludeToggle>('EXCLUDE')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isExclude = excludeToggle === 'EXCLUDE'
  const { data, isLoading, isError } = useMarketMap(market, isExclude)

  const allGroups = data?.items ?? []
  const groups = selectedCategory ? allGroups.filter(g => g.categoryName === selectedCategory) : allGroups

  const handleMarketChange = (next: Market) => {
    setMarket(next)
    setSelectedCategory(null)
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="p-4">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <TabSelector options={MARKETS} value={market} onChange={handleMarketChange} />
              <TabSelector options={EXCLUDE_TOGGLES} value={excludeToggle} onChange={setExcludeToggle} labelFor={excludeToggleLabel} />
              {selectedCategory && (
                <button type="button" className="nes-btn text-xs" onClick={() => setSelectedCategory(null)}>
                  ← 전체 카테고리
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {data?.snapshotTime && (
                <span className="text-xs text-gray-500">기준: {toDateTimeLabel(data.snapshotTime)}</span>
              )}
              <button type="button" className="nes-btn text-xs" onClick={() => setSidebarOpen(true)}>
                제외/재분류 관리
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-gray-500">불러오는 중...</div>
          ) : isError ? (
            <div className="p-8 text-center text-xs text-gray-500">데이터를 불러오지 못했습니다</div>
          ) : groups.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">데이터가 없습니다</div>
          ) : (
            <MarketMapTreemap groups={groups} onSelectCategory={setSelectedCategory} />
          )}
        </div>
      </div>

      <MarketMapManageSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  )
}
