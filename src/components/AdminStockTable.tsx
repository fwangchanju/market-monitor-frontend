import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CategoryItem, StockCategoryListItem } from '@/types/api'
import { toJoEokDecimal } from '@/utils/format'
import { useAssignStockCategory } from '@/hooks/useMarketMapAdmin'
import Spinner from './Spinner'

interface Props {
  items: StockCategoryListItem[]
  categories: CategoryItem[]
}

type SortKey = 'stockCode' | 'stockName' | 'totalMarketValue' | 'market' | 'parentCategoryName' | 'categoryName'
type SortDirection = 'asc' | 'desc'

const NUMBER_COLUMN_WIDTH = '5%'

const COLUMNS: { key: SortKey; header: string; width: string; align: 'center' | 'right' }[] = [
  { key: 'stockCode', header: '종목코드', width: '10%', align: 'center' },
  { key: 'stockName', header: '종목명', width: '20%', align: 'right' },
  { key: 'totalMarketValue', header: '시가총액', width: '15%', align: 'right' },
  { key: 'market', header: '마켓타입', width: '10%', align: 'center' },
  { key: 'parentCategoryName', header: '대분류', width: '20%', align: 'right' },
  { key: 'categoryName', header: '소분류', width: '20%', align: 'right' },
]

const alignClass = (align: 'center' | 'left' | 'right') =>
  align === 'right' ? 'text-right pr-4' : align === 'left' ? 'text-left pl-4' : 'text-center'

function compareByKey(a: StockCategoryListItem, b: StockCategoryListItem, key: SortKey): number {
  if (key === 'totalMarketValue') {
    return (a.totalMarketValue ?? -Infinity) - (b.totalMarketValue ?? -Infinity)
  }
  return (a[key] ?? '').localeCompare(b[key] ?? '', 'ko')
}

// 카테고리를 부모-자식 순서로 펼쳐서 검색 옵션으로 만든다 (자식은 들여쓰기 표시).
function buildCategoryOptions(categories: CategoryItem[]): { id: number; name: string; label: string }[] {
  const byParent = new Map<number | null, CategoryItem[]>()
  for (const c of categories) {
    const list = byParent.get(c.parentId)
    if (list) list.push(c)
    else byParent.set(c.parentId, [c])
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  const options: { id: number; name: string; label: string }[] = []
  const walk = (parentId: number | null, depth: number) => {
    for (const c of byParent.get(parentId) ?? []) {
      options.push({ id: c.id, name: c.name, label: `${'　'.repeat(depth)}${depth > 0 ? '- ' : ''}${c.name}` })
      walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return options
}

interface CategoryOption {
  id: number
  name: string
  label: string
}

// 대분류/소분류 셀. 검색창 열림 상태를 이 컴포넌트 안에서만 갖고 있어서,
// 타이핑해도 전체 종목 테이블(2700여 행)이 다시 렌더되지 않는다.
function AdminStockCategoryCell({
  value,
  options,
  onAssign,
}: {
  value: string
  options: CategoryOption[]
  onAssign: (categoryId: number) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [position, setPosition] = useState<{ top: number; left: number; openUpward: boolean } | null>(null)
  const cellRef = useRef<HTMLTableCellElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (isOpen && cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect()
      const openUpward = rect.bottom > window.innerHeight * 0.8
      setPosition({ top: openUpward ? rect.top : rect.bottom, left: rect.left, openUpward })
      inputRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const close = () => setIsOpen(false)
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (popupRef.current?.contains(target) || cellRef.current?.contains(target)) return
      close()
    }
    // capture 없이 window 자체의 scroll(페이지 스크롤)만 감지 — capture:true였으면
    // 팝업 내부 목록의 overflow-y-auto 스크롤까지 잡혀서 즉시 닫혀버림.
    window.addEventListener('scroll', close)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('scroll', close)
    }
  }, [isOpen])

  const handleSelect = (categoryId: number) => {
    onAssign(categoryId)
    setIsOpen(false)
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (matches.length === 0) return
      setHighlightedIndex(i => (i < 0 ? 0 : (i + 1) % matches.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (matches.length === 0) return
      setHighlightedIndex(i => (i <= 0 ? matches.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = matches[highlightedIndex]
      if (target) handleSelect(target.id)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const trimmed = query.trim().toLowerCase()
  const matches = trimmed ? options.filter(opt => opt.name.toLowerCase().includes(trimmed)) : []

  return (
    <td
      ref={cellRef}
      className="cursor-pointer pl-4 text-left hover:bg-[#4f8fd6]/20"
      onClick={() => {
        setQuery('')
        setHighlightedIndex(-1)
        setIsOpen(true)
      }}
    >
      {value}
      {isOpen && position && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            transform: position.openUpward ? 'translateY(-100%)' : undefined,
          }}
          className="nes-container is-dark z-50 w-64 p-2"
          onClick={e => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="카테고리 검색"
            className="nes-input is-dark w-full text-xs"
          />
          <div className="mt-2 border-t border-gray-600 pt-2">
            <div className="max-h-16 overflow-y-auto">
              {!trimmed ? null : matches.length === 0 ? (
                <p className="px-2 py-1 text-xs text-gray-400">검색 결과가 없습니다</p>
              ) : (
                matches.map((opt, index) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`block w-full truncate rounded px-2 py-1 text-left text-xs text-white ${
                      index === highlightedIndex ? 'bg-[#4f8fd6]/30' : 'bg-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </td>
  )
}

export default function AdminStockTable({ items, categories }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('stockCode')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [isSorting, setIsSorting] = useState(false)

  const assignStockCategory = useAssignStockCategory()
  const categoryOptions = buildCategoryOptions(categories)

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
    setIsSorting(true)
    setTimeout(() => setIsSorting(false), 400)
  }

  const handleAssign = (stockCode: string, categoryId: number) => {
    assignStockCategory.mutate({ stockCode, categoryId })
  }

  const sorted = [...items].sort((a, b) => {
    const cmp = compareByKey(a, b, sortKey)
    return sortDirection === 'asc' ? cmp : -cmp
  })

  return (
    <div>
      <p className="mb-2 px-2 text-sm font-bold text-white">종목 목록 ({items.length})</p>
      <div className="overflow-x-auto scrollbar-hide">
        <table className="nes-table is-dark is-bordered w-full text-xs">
          <thead>
            <tr>
              <th className="bg-[#4f8fd6] text-center" style={{ width: NUMBER_COLUMN_WIDTH }}>
                #
              </th>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{ width: col.width }}
                  className="cursor-pointer select-none whitespace-nowrap bg-[#4f8fd6] text-center hover:text-yellow-400"
                >
                  {col.header}
                  {sortKey === col.key && <span className="ml-1 text-gray-400">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isSorting ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="p-8">
                  <div className="flex justify-center">
                    <Spinner />
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((item, index) => (
                <tr key={item.stockCode}>
                  <td className="text-center text-gray-400">{index + 1}</td>
                  <td className="text-center">{item.stockCode}</td>
                  <td className={`${alignClass('right')} ${item.market === 'KOSPI' ? 'text-white' : 'text-[#4f8fd6]'}`}>
                    {item.stockName}
                  </td>
                  <td className={alignClass('right')}>
                    {item.totalMarketValue != null ? toJoEokDecimal(item.totalMarketValue / 100_000_000) : '-'}
                  </td>
                  <td className="text-center">{item.market}</td>
                  <AdminStockCategoryCell
                    value={item.parentCategoryName}
                    options={categoryOptions}
                    onAssign={categoryId => handleAssign(item.stockCode, categoryId)}
                  />
                  <AdminStockCategoryCell
                    value={item.categoryName ?? '-'}
                    options={categoryOptions}
                    onAssign={categoryId => handleAssign(item.stockCode, categoryId)}
                  />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
