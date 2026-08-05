import { useQueryClient } from '@tanstack/react-query'
import { useExcludedStocks } from '@/hooks/useExcludedStocks'
import { unregisterExcludedStock, deleteAllExcludedStocks } from '@/api/marketMap'
import { marketMapKeys } from '@/hooks/queryKeys'

export default function AdminExcludedStockSection() {
  const { data: excluded } = useExcludedStocks()
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: marketMapKeys.all })

  const handleRemove = async (stockCode: string) => {
    await unregisterExcludedStock(stockCode)
    invalidate()
  }

  const handleReset = async () => {
    if (!window.confirm('제외종목목록을 초기화하시겠습니까?')) return
    await deleteAllExcludedStocks()
    invalidate()
  }

  return (
    <div className="nes-container with-title is-dark w-64 shrink-0">
      <p className="title flex w-full items-center justify-between gap-2">
        <span className="whitespace-nowrap text-sm">제외종목목록{excluded ? `(${excluded.length})` : ''}</span>
        {excluded && excluded.length > 0 && (
          <button
            type="button"
            className="nes-btn is-error shrink-0 whitespace-nowrap px-2 text-xs"
            onClick={handleReset}
          >
            초기화
          </button>
        )}
      </p>
      <div className="flex h-48 flex-col gap-2 overflow-y-auto">
        {excluded?.map(stock => (
          <div
            key={stock.stockCode}
            className="nes-container is-rounded is-dark flex items-center justify-between gap-2 px-2 py-1"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[10.5px] text-white">{stock.stockName}</span>
              <span className="text-[10.5px] text-white">{stock.stockCode}</span>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(stock.stockCode)}
              className="border-0 bg-transparent text-red-500 hover:text-red-400"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
