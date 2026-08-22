import { useState } from 'react'
import type { Market } from '@/types/api'
import { ChevronLeftIcon } from './icons/MarketMapIcons'

const FILTER_ITEMS: { label: string; market?: Market }[] = [
  { label: 'KOSPI', market: 'KOSPI' },
  { label: 'KOSDAQ', market: 'KOSDAQ' },
  { label: 'All Stocks' },
]

interface Props {
  market: Market
  onMarketChange: (market: Market) => void
}

export default function MarketMapFilterSidebar({ market, onMarketChange }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`relative shrink-0 bg-[var(--surface)] text-sm transition-[width] duration-200 ${collapsed ? 'w-4' : 'w-56'}`}
    >
      <div className={`h-full overflow-hidden transition-[width] duration-200 ${collapsed ? 'w-0' : 'w-56'}`}>
        <div className="w-56 border-b border-gray-700 p-4">
          <p className="mb-2 font-bold text-white">FILTER</p>
          <ul className="flex list-none flex-col gap-1">
            {FILTER_ITEMS.map(({ label, market: m }) => (
              <li key={label}>
                {m ? (
                  <button
                    type="button"
                    onClick={() => onMarketChange(m)}
                    className={`w-full rounded border-0 bg-transparent px-2 py-1 text-left font-bold ${
                      market === m ? 'bg-gray-700 text-[#4f8fd6]' : 'text-white hover:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-not-allowed rounded border-0 bg-transparent px-2 py-1 text-left font-bold text-gray-500"
                  >
                    {label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <button
        type="button"
        aria-label={collapsed ? '사이드바 열기' : '사이드바 닫기'}
        onClick={() => setCollapsed(prev => !prev)}
        className="absolute right-0 top-0 z-10 flex h-full w-4 items-center justify-center border-0 bg-[var(--surface)] text-white hover:bg-gray-700"
      >
        <ChevronLeftIcon className={`h-3 w-3 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
      </button>
    </aside>
  )
}
