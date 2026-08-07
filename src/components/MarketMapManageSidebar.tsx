import { useQueryClient } from '@tanstack/react-query'
import Sidebar from './Sidebar'
import { useExcludedStocks } from '@/hooks/useExcludedStocks'
import { marketMapKeys } from '@/hooks/queryKeys'
import { unregisterExcludedStock, deleteAllExcludedStocks } from '@/api/marketMap'

interface Props {
  open: boolean
  onClose: () => void
}

export default function MarketMapManageSidebar({ open, onClose }: Props) {
  const { data: excluded } = useExcludedStocks()
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: marketMapKeys.all })

  const handleUnregisterExcluded = async (stockCode: string) => {
    await unregisterExcludedStock(stockCode)
    invalidate()
  }

  const handleDeleteAllExcluded = async () => {
    await deleteAllExcludedStocks()
    invalidate()
  }

  return (
    <Sidebar open={open} onClose={onClose}>
      <div className="nes-container with-title is-dark">
        <p className="title flex w-full items-center justify-between gap-2">
          <span className="whitespace-nowrap text-sm">제외종목{excluded ? `(${excluded.length})` : ''}</span>
          {excluded && excluded.length > 0 && (
            <button
              type="button"
              className="nes-btn is-error shrink-0 whitespace-nowrap px-2 text-xs"
              onClick={handleDeleteAllExcluded}
            >
              초기화
            </button>
          )}
        </p>
        <div className="flex h-40 flex-col gap-2 overflow-y-auto">
          {!excluded || excluded.length === 0 ? (
            <p className="nes-text is-disabled text-xs">제외된 종목이 없습니다</p>
          ) : (
            excluded.map(stock => (
              <div key={stock.stockCode} className="flex items-center justify-between gap-2 text-[10.5px]">
                <span>{stock.stockName}</span>
                <button
                  type="button"
                  onClick={() => handleUnregisterExcluded(stock.stockCode)}
                  className="border-0 bg-transparent text-red-500 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Sidebar>
  )
}
