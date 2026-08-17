import type { Market } from '@/types/api'

const FILTER_ITEMS: { label: string; market?: Market }[] = [
  { label: 'KOSPI', market: 'KOSPI' },
  { label: 'KOSPI200' },
  { label: 'KOSDAQ', market: 'KOSDAQ' },
  { label: 'KOSDAQ150' },
  { label: 'All Stocks' },
  { label: '시가총액순' },
]

interface Props {
  market: Market
  onMarketChange: (market: Market) => void
  compact?: boolean
}

export default function MarketMapFilterSidebar({ market, onMarketChange, compact = false }: Props) {
  return (
    <aside className={`shrink-0 bg-[var(--surface)] ${compact ? 'w-28 text-xs' : 'w-56 text-sm'}`}>
      <div className={`border-b border-gray-700 ${compact ? 'p-2' : 'p-4'}`}>
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
    </aside>
  )
}
