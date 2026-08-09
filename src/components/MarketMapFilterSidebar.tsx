import { useQueryClient } from '@tanstack/react-query'
import type { Market } from '@/types/api'
import { useExcludedStocks } from '@/hooks/useExcludedStocks'
import { unregisterExcludedStock } from '@/api/marketMap'
import { marketMapKeys } from '@/hooks/queryKeys'

const MARKETS: Market[] = ['KOSPI', 'KOSDAQ']

interface Props {
  market: Market
  onMarketChange: (market: Market) => void
  isExclude: boolean
  onToggleExclude: () => void
  isCustom: boolean
  onToggleCustom: () => void
  compact?: boolean
}

export default function MarketMapFilterSidebar({
  market,
  onMarketChange,
  isExclude,
  onToggleExclude,
  isCustom,
  onToggleCustom,
  compact = false,
}: Props) {
  const { data: excluded } = useExcludedStocks()
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: marketMapKeys.all })

  const handleRemove = async (stockCode: string) => {
    await unregisterExcludedStock(stockCode)
    invalidate()
  }

  return (
    <aside className={`shrink-0 bg-[var(--surface)] ${compact ? 'w-28 text-xs' : 'w-56 text-sm'}`}>
      <div className={`border-b border-gray-700 ${compact ? 'p-2' : 'p-4'}`}>
        <p className="mb-2 font-bold text-white">FILTER</p>
        <ul className="flex list-none flex-col gap-1">
          {MARKETS.map(m => (
            <li key={m}>
              <button
                type="button"
                onClick={() => onMarketChange(m)}
                className={`w-full rounded border-0 bg-transparent px-2 py-1 text-left font-bold ${
                  market === m ? 'bg-gray-700 text-[#4f8fd6]' : 'text-white hover:text-gray-300'
                }`}
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className={compact ? 'p-2' : 'p-4'}>
        <label className={`flex items-center gap-2 whitespace-nowrap text-white ${compact ? 'text-[9px]' : ''}`}>
          <input type="checkbox" checked={isExclude} onChange={onToggleExclude} />
          대형주제외
        </label>
        <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
          {excluded?.map(stock => (
            <div key={stock.stockCode} className="flex items-center justify-between gap-1 px-1 py-0.5">
              <span className={`truncate text-white ${compact ? 'text-[9px]' : 'text-[10.5px]'}`}>- {stock.stockName}</span>
              <button
                type="button"
                onClick={() => handleRemove(stock.stockCode)}
                className="shrink-0 border-0 bg-transparent text-red-500 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <label className={`mt-6 flex items-center gap-2 whitespace-nowrap text-white ${compact ? 'text-[9px]' : ''}`}>
          <input type="checkbox" checked={isCustom} onChange={onToggleCustom} />
          CUSTOM
        </label>
      </div>
    </aside>
  )
}
