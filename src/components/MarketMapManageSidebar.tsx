import { useQueryClient } from '@tanstack/react-query'
import Sidebar from './Sidebar'
import { useExcludedStocks } from '@/hooks/useExcludedStocks'
import { useStockCategories } from '@/hooks/useStockCategories'
import { marketMapKeys } from '@/hooks/queryKeys'
import {
  unregisterExcludedStock,
  deleteAllExcludedStocks,
  deleteCategory,
  deleteAllCategories,
} from '@/api/marketMap'

interface Props {
  open: boolean
  onClose: () => void
}

export default function MarketMapManageSidebar({ open, onClose }: Props) {
  const { data: excluded } = useExcludedStocks()
  const { data: categories } = useStockCategories()
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

  const handleDeleteCategory = async (stockCode: string) => {
    await deleteCategory(stockCode)
    invalidate()
  }

  const handleDeleteAllCategories = async () => {
    await deleteAllCategories()
    invalidate()
  }

  return (
    <Sidebar open={open} onClose={onClose}>
      <div className="nes-container with-title is-dark">
        <p className="title">제외 종목{excluded ? ` (${excluded.length})` : ''}</p>
        {excluded && excluded.length > 0 && (
          <button type="button" className="nes-btn is-error mb-2 text-xs" onClick={handleDeleteAllExcluded}>
            전체 초기화
          </button>
        )}
        <div className="flex h-40 flex-col gap-2 overflow-y-auto">
          {!excluded || excluded.length === 0 ? (
            <p className="nes-text is-disabled text-xs">제외된 종목이 없습니다</p>
          ) : (
            excluded.map(stock => (
              <div key={stock.stockCode} className="flex items-center justify-between gap-2 text-xs">
                <span>{stock.stockName}</span>
                <button
                  type="button"
                  onClick={() => handleUnregisterExcluded(stock.stockCode)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="nes-container with-title is-dark">
        <p className="title">재분류 종목{categories ? ` (${categories.length})` : ''}</p>
        {categories && categories.length > 0 && (
          <button type="button" className="nes-btn is-error mb-2 text-xs" onClick={handleDeleteAllCategories}>
            전체 초기화
          </button>
        )}
        <div className="flex h-40 flex-col gap-2 overflow-y-auto">
          {!categories || categories.length === 0 ? (
            <p className="nes-text is-disabled text-xs">재분류된 종목이 없습니다</p>
          ) : (
            categories.map(stock => (
              <div key={stock.stockCode} className="flex items-center justify-between gap-2 text-xs">
                <span>
                  {stock.stockName} → {stock.categoryName}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(stock.stockCode)}
                  className="text-gray-400 hover:text-white"
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
