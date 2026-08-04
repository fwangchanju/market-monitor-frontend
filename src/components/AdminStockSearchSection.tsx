import { useState } from 'react'
import { useStocks } from '@/hooks/useStocks'
import AdminSection from './AdminSection'
import AdminDraggableStockChip from './AdminDraggableStockChip'

export default function AdminStockSearchSection() {
  const [query, setQuery] = useState('')
  const { data } = useStocks()

  const trimmed = query.trim().toLowerCase()
  const matches = trimmed
    ? data?.filter((s) => s.stockName.toLowerCase().includes(trimmed) || s.stockCode.includes(trimmed))
    : []

  return (
    <AdminSection title="종목 검색">
      <input
        type="text"
        className="nes-input is-dark text-xs"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="종목명/코드 검색"
      />
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {!trimmed ? null : matches && matches.length === 0 ? (
          <p className="nes-text is-disabled text-xs">검색 결과가 없습니다</p>
        ) : (
          matches?.map((item) => (
            <AdminDraggableStockChip key={item.stockCode} stockCode={item.stockCode} stockName={item.stockName} />
          ))
        )}
      </div>
    </AdminSection>
  )
}
