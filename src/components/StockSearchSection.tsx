import { useState } from 'react'
import { useStocks } from '@/hooks/useStocks'
import { useWatchStocks } from '@/hooks/useWatchStocks'
import DraggableStockChip from './DraggableStockChip'

export default function StockSearchSection() {
  const [query, setQuery] = useState('')
  const { data } = useStocks()
  const { data: watchStocks } = useWatchStocks()

  const trimmed = query.trim().toLowerCase()
  const registeredCodes = watchStocks?.map(s => s.stockCode) ?? []
  const matches = trimmed
    ? data?.filter(
        s =>
          (s.stockName.toLowerCase().startsWith(trimmed) || s.stockCode.startsWith(trimmed)) &&
          !registeredCodes.includes(s.stockCode),
      )
    : []

  return (
    <div className="nes-container with-title">
      <p className="title">종목 검색</p>
      <input
        type="text"
        className="nes-input mb-2"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="종목명 또는 코드"
      />
      <div className="flex h-56 flex-col gap-2 overflow-y-auto">
        {!trimmed ? (
          <p className="nes-text is-disabled text-xs">종목명 또는 코드를 입력하세요</p>
        ) : matches && matches.length === 0 ? (
          <p className="nes-text is-disabled text-xs">검색 결과가 없습니다</p>
        ) : (
          matches?.map(item => (
            <DraggableStockChip key={item.stockCode} source="search" stockCode={item.stockCode} stockName={item.stockName} />
          ))
        )}
      </div>
    </div>
  )
}
