import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { CategoryItem, StockCategoryListItem } from '@/types/api'
import { toJoEokDecimal } from '@/utils/format'
import { useAssignStockCategory, useBulkAssignStockCategory, useUpdateAlias } from '@/hooks/useMarketMapAdmin'
import Spinner from './Spinner'

interface Props {
  items: StockCategoryListItem[]
  categories: CategoryItem[]
}

type SortKey =
  | 'stockCode'
  | 'market'
  | 'stockName'
  | 'alias'
  | 'totalMarketValue'
  | 'originCategoryName'
  | 'parentCategoryName'
  | 'categoryName'
type SortDirection = 'asc' | 'desc'

const NUMBER_COLUMN_WIDTH = '5%'
const CHECKBOX_COLUMN_WIDTH = '3%'

const COLUMNS: { key: SortKey; header: string; width: string; align: 'center' | 'left' | 'right' }[] = [
  { key: 'stockCode', header: '종목코드', width: '10%', align: 'center' },
  { key: 'market', header: '마켓', width: '8%', align: 'center' },
  { key: 'stockName', header: '종목명', width: '13%', align: 'left' },
  { key: 'alias', header: '약칭', width: '10%', align: 'left' },
  { key: 'totalMarketValue', header: '시가총액', width: '12%', align: 'right' },
  { key: 'originCategoryName', header: '업종', width: '14%', align: 'right' },
  { key: 'parentCategoryName', header: '대분류', width: '14%', align: 'right' },
  { key: 'categoryName', header: '소분류', width: '14%', align: 'right' },
]

const alignClass = (align: 'center' | 'left' | 'right') =>
  align === 'right' ? 'text-right pr-4' : align === 'left' ? 'text-left pl-4' : 'text-center'

const MARKET_LABEL: Record<'KOSPI' | 'KOSDAQ', string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
const marketColorClass = (market: 'KOSPI' | 'KOSDAQ') => (market === 'KOSPI' ? 'text-white' : 'text-[#4f8fd6]')

const KOREAN_COLLATOR = new Intl.Collator('ko')

function compareByKey(a: StockCategoryListItem, b: StockCategoryListItem, key: SortKey): number {
  if (key === 'totalMarketValue') {
    return (a.totalMarketValue ?? -Infinity) - (b.totalMarketValue ?? -Infinity)
  }
  return KOREAN_COLLATOR.compare(a[key] ?? '', b[key] ?? '')
}

// 화면에 실제로 표시되는 값 기준 — 필터 옵션 목록/필터링 판정 둘 다 이 값으로 통일해서 화면과 어긋나지 않게 한다.
type FilterKey = 'market' | 'originCategoryName' | 'parentCategoryName' | 'categoryName'
const FILTER_KEYS: readonly FilterKey[] = ['market', 'originCategoryName', 'parentCategoryName', 'categoryName']

function isFilterKey(key: SortKey): key is FilterKey {
  return (FILTER_KEYS as readonly string[]).includes(key)
}

const DISPLAY_VALUE: Record<FilterKey, (item: StockCategoryListItem) => string> = {
  market: item => MARKET_LABEL[item.market],
  originCategoryName: item => item.originCategoryName ?? '-',
  parentCategoryName: item => item.parentCategoryName ?? item.categoryName,
  categoryName: item => (item.parentCategoryName ? item.categoryName : '-'),
}

// 카테고리를 부모-자식 순서로 펼쳐서 검색 옵션으로 만든다 (자식은 들여쓰기 표시).
function buildCategoryOptions(categories: CategoryItem[]): CategoryOption[] {
  const byParent = new Map<number | null, CategoryItem[]>()
  for (const c of categories) {
    const list = byParent.get(c.parentId)
    if (list) list.push(c)
    else byParent.set(c.parentId, [c])
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  const options: CategoryOption[] = []
  const walk = (parentId: number | null, depth: number) => {
    for (const c of byParent.get(parentId) ?? []) {
      options.push({
        id: c.id,
        parentId: c.parentId,
        name: c.name,
        label: `${'　'.repeat(depth)}${depth > 0 ? '- ' : ''}${c.name}`,
      })
      walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return options
}

interface CategoryOption {
  id: number
  parentId: number | null
  name: string
  label: string
}

// 검색어가 자기 이름이나 조상(부모/조부모...) 중 하나에라도 걸리면 매칭으로 본다.
// 예: "반"으로 검색하면 "반도체"뿐 아니라 그 하위 "메모리"/"파운드리"도 같이 남는다.
function matchesCategorySearch(option: CategoryOption, trimmed: string, byId: Map<number, CategoryOption>): boolean {
  let current: CategoryOption | undefined = option
  while (current) {
    if (current.name.toLowerCase().includes(trimmed)) return true
    current = current.parentId != null ? byId.get(current.parentId) : undefined
  }
  return false
}

interface PopupPosition {
  top: number
  left: number
  openUpward: boolean
  alignRight: boolean
}

// 팝업(카테고리 검색창/필터 드롭다운) 공통 로직 — 트리거 기준 위치 계산 + 바깥 클릭/스크롤 시 닫기.
function usePopupPosition(
  isOpen: boolean,
  setIsOpen: (open: boolean) => void,
  triggerRef: React.RefObject<HTMLElement | null>,
  popupRef: React.RefObject<HTMLElement | null>,
  onOpen?: () => void,
  // 팝업이 아래로 열렸을 때 화면 밖으로 잘리지 않게, 트리거가 화면 세로 기준 몇 % 아래부터 위로 뒤집을지.
  // 팝업이 클수록(예: 카테고리 검색 목록) 더 일찍(작은 값) 뒤집어야 한다.
  flipThreshold = 0.8,
  // 트리거가 화면 우측 끝에 붙어있으면(예: 일괄변경 버튼) 왼쪽으로 열어야 화면 밖으로 안 잘린다.
  alignRight = false,
) {
  const [position, setPosition] = useState<PopupPosition | null>(null)

  useLayoutEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const openUpward = rect.bottom > window.innerHeight * flipThreshold
      setPosition({
        top: openUpward ? rect.top : rect.bottom,
        left: alignRight ? rect.right : rect.left,
        openUpward,
        alignRight,
      })
      onOpen?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref는 안정적이고 onOpen은 open 시점 1회 실행이면 충분
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const close = () => setIsOpen(false)
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref/setIsOpen은 안정적이라 isOpen 변화에만 반응하면 됨
  }, [isOpen])

  return position
}

// 카테고리 검색창의 검색어/방향키 탐색 상태 — AdminStockCategoryCell과 BulkAssignButton이 공유.
// isOpen이 false(팝업 닫힘)면 아무도 matches를 안 쓰므로 계산 자체를 건너뛴다 — 행이 수천 개라
// 팝업 열림 여부와 무관하게 매 렌더마다 계산하면 그 비용이 그대로 누적된다.
function useCategorySearchState(options: CategoryOption[], isOpen: boolean) {
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const reset = () => {
    setQuery('')
    setHighlightedIndex(-1)
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setHighlightedIndex(-1)
  }

  const trimmed = query.trim().toLowerCase()
  // 검색 전엔 전체 카테고리를 그대로 보여주고(방향키로 바로 탐색 가능), 검색어가 있으면 그 안에서만 필터링한다.
  // 부모가 매칭되면 그 하위 카테고리도 같이 남겨서(예: "반" -> 반도체 + 메모리/파운드리), 트리 맥락이 끊기지 않게 한다.
  const matches = useMemo(() => {
    if (!isOpen || !trimmed) return options
    const optionsById = new Map(options.map(opt => [opt.id, opt]))
    return options.filter(opt => matchesCategorySearch(opt, trimmed, optionsById))
  }, [isOpen, trimmed, options])

  const handleArrowsAndEnter = (e: React.KeyboardEvent<HTMLInputElement>, onSelect: (categoryId: number) => void) => {
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
      if (target) onSelect(target.id)
    }
  }

  return { query, handleQueryChange, matches, highlightedIndex, setHighlightedIndex, handleArrowsAndEnter, reset }
}

// 카테고리 검색 팝업(검색창 + 전체/필터링된 목록). 대분류·소분류 셀과 일괄변경 버튼이 트리거만 다르게 해서 같이 쓴다.
function CategorySearchPopup({
  popupRef,
  inputRef,
  position,
  search,
  onSelect,
  onEscape,
}: {
  popupRef: React.RefObject<HTMLDivElement | null>
  inputRef: React.RefObject<HTMLInputElement | null>
  position: PopupPosition
  search: ReturnType<typeof useCategorySearchState>
  onSelect: (categoryId: number) => void
  onEscape: () => void
}) {
  return (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: `translate(${position.alignRight ? '-100%' : '0'}, ${position.openUpward ? '-100%' : '0'})`,
      }}
      className="nes-container is-dark z-50 w-64 !bg-violet-950 p-2"
      onClick={e => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        autoFocus
        value={search.query}
        onChange={e => search.handleQueryChange(e.target.value)}
        onKeyDown={e => (e.key === 'Escape' ? onEscape() : search.handleArrowsAndEnter(e, onSelect))}
        placeholder="카테고리 검색"
        className="nes-input is-dark w-full text-xs"
      />
      <div className="mt-2 border-t border-gray-600 pt-2">
        <div className="max-h-72 overflow-y-auto">
          {search.matches.length === 0 ? (
            <p className="px-2 py-1 text-xs text-gray-400">검색 결과가 없습니다</p>
          ) : (
            search.matches.map((opt, index) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelect(opt.id)}
                onMouseEnter={() => search.setHighlightedIndex(index)}
                className={`block w-full truncate rounded px-2 py-1 text-left text-xs text-white ${
                  index === search.highlightedIndex ? 'bg-[#4f8fd6]/30' : 'bg-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// 대분류/소분류 셀. 검색창 열림 상태를 이 컴포넌트 안에서만 갖고 있어서,
// 타이핑해도 전체 종목 테이블(2700여 행)이 다시 렌더되지 않는다.
function AdminStockCategoryCell({
  value,
  options,
  onAssign,
  isHighlighted,
  onHoverStart,
  onHoverEnd,
}: {
  value: string
  options: CategoryOption[]
  onAssign: (categoryId: number) => void
  isHighlighted: boolean
  onHoverStart: () => void
  onHoverEnd: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const cellRef = useRef<HTMLTableCellElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const search = useCategorySearchState(options, isOpen)

  // 카테고리 목록 팝업은 세로로 훨씬 커져서(약 12개 높이), 기본 임계값(80%)보다 일찍 위로 뒤집어야 화면 밖으로 안 잘린다.
  const position = usePopupPosition(isOpen, setIsOpen, cellRef, popupRef, () => inputRef.current?.focus(), 0.6)

  const handleSelect = (categoryId: number) => {
    onAssign(categoryId)
    setIsOpen(false)
  }

  return (
    <td
      ref={cellRef}
      className={`cursor-pointer pl-4 text-left ${isHighlighted ? 'bg-yellow-400/50' : ''}`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={() => {
        search.reset()
        setIsOpen(true)
      }}
    >
      {value}
      {isOpen && position && (
        <CategorySearchPopup
          popupRef={popupRef}
          inputRef={inputRef}
          position={position}
          search={search}
          onSelect={handleSelect}
          onEscape={() => setIsOpen(false)}
        />
      )}
    </td>
  )
}

// 체크된 종목들을 한 카테고리로 한 번에 재배정하는 버튼. 팝업 자체는 AdminStockCategoryCell과 동일하게 동작한다.
function BulkAssignButton({
  count,
  options,
  onAssign,
}: {
  count: number
  options: CategoryOption[]
  onAssign: (categoryId: number) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const search = useCategorySearchState(options, isOpen)

  // 버튼이 화면 우측 끝에 붙어있어서, 팝업은 버튼 오른쪽 끝에 맞춰 왼쪽으로 열리게 한다.
  const position = usePopupPosition(
    isOpen,
    setIsOpen,
    buttonRef,
    popupRef,
    () => inputRef.current?.focus(),
    0.6,
    true,
  )

  const handleSelect = (categoryId: number) => {
    onAssign(categoryId)
    setIsOpen(false)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          search.reset()
          setIsOpen(true)
        }}
        className="nes-btn border-sky-500 bg-sky-500 text-xs text-white hover:bg-sky-600"
      >
        일괄변경 ({count})
      </button>
      {isOpen && position && (
        <CategorySearchPopup
          popupRef={popupRef}
          inputRef={inputRef}
          position={position}
          search={search}
          onSelect={handleSelect}
          onEscape={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

// 약칭 셀. 클릭하면 입력창으로 바뀌고, Enter로 저장/Escape로 취소. 빈 값으로 저장하면 약칭이 지워진다(null).
function AdminAliasCell({
  alias,
  onUpdate,
}: {
  alias: string | null
  onUpdate: (alias: string | null) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState('')

  const startEdit = () => {
    setValue(alias ?? '')
    setIsEditing(true)
  }

  const submit = () => {
    const trimmed = value.trim()
    const next = trimmed === '' ? null : trimmed
    setIsEditing(false)
    if (next === alias) return
    onUpdate(next)
  }

  if (isEditing) {
    return (
      <td className={alignClass('left')}>
        <input
          type="text"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={() => setIsEditing(false)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') setIsEditing(false)
          }}
          className="nes-input is-dark w-full text-left text-xs"
        />
      </td>
    )
  }

  return (
    <td
      className={`cursor-pointer hover:bg-yellow-400/50 ${alignClass('left')}`}
      onClick={startEdit}
    >
      {alias ?? '-'}
    </td>
  )
}

// 컬럼 헤더의 필터 버튼 — 체크된 값만 화면에 남기는 엑셀 스타일 필터.
function AdminColumnFilterButton({
  options,
  excluded,
  onToggle,
  onSelectAll,
  onSelectNone,
}: {
  options: string[]
  excluded: Set<string>
  onToggle: (value: string) => void
  onSelectAll: () => void
  onSelectNone: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const isFiltered = excluded.size > 0

  const position = usePopupPosition(isOpen, setIsOpen, buttonRef, popupRef)

  const isAllSelected = excluded.size === 0
  const handleToggleAll = () => {
    if (isAllSelected) onSelectNone()
    else onSelectAll()
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={e => {
          e.stopPropagation()
          setIsOpen(prev => !prev)
        }}
        className={`rounded bg-transparent px-1 normal-case ${isFiltered ? 'text-yellow-400' : 'text-white/70 hover:text-white'}`}
        title="필터"
      >
        ▼
      </button>
      {isOpen && position && (
        <div
          ref={popupRef}
          style={{ position: 'fixed', top: position.top, left: position.left }}
          className="nes-container is-dark z-50 w-48 !bg-violet-950 p-2 text-left normal-case"
          onClick={e => e.stopPropagation()}
        >
          <label className="flex cursor-pointer items-center gap-1.5 rounded border-b border-gray-600 px-1 py-1 text-xs font-bold text-white hover:bg-yellow-400/50">
            <input type="checkbox" checked={isAllSelected} onChange={handleToggleAll} />
            <span>전체</span>
          </label>
          <div className="max-h-48 overflow-y-auto pt-1">
            {options.map(opt => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-xs text-white hover:bg-yellow-400/50"
              >
                <input type="checkbox" checked={!excluded.has(opt)} onChange={() => onToggle(opt)} />
                <span className="truncate">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// 종목 한 행. React.memo로 감싸서, 다른 행의 체크박스/hover로 부모가 리렌더돼도
// props가 안 바뀐 행은 리렌더를 건너뛴다 (행이 2700여 개라 이게 없으면 체크박스 하나 눌러도 전체가 다시 그려진다).
const AdminStockRow = memo(function AdminStockRow({
  item,
  index,
  isSelected,
  onToggleSelected,
  isHighlighted,
  onHoverStart,
  onHoverEnd,
  categoryOptions,
  onAssign,
  onUpdateAlias,
}: {
  item: StockCategoryListItem
  index: number
  isSelected: boolean
  onToggleSelected: (stockCode: string) => void
  isHighlighted: boolean
  onHoverStart: (stockCode: string) => void
  onHoverEnd: () => void
  categoryOptions: CategoryOption[]
  onAssign: (stockCode: string, categoryId: number) => void
  onUpdateAlias: (stockCode: string, alias: string | null) => void
}) {
  return (
    <tr>
      <td className="text-center">
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelected(item.stockCode)} />
      </td>
      <td className="text-center text-gray-400">{index + 1}</td>
      <td className="text-center">{item.stockCode}</td>
      <td className={`text-center ${marketColorClass(item.market)}`}>{MARKET_LABEL[item.market]}</td>
      <td className={`${alignClass('left')} ${marketColorClass(item.market)}`}>{item.stockName}</td>
      <AdminAliasCell alias={item.alias} onUpdate={alias => onUpdateAlias(item.stockCode, alias)} />
      <td className={alignClass('right')}>
        {item.totalMarketValue != null ? toJoEokDecimal(item.totalMarketValue / 100_000_000) : '-'}
      </td>
      <td className={alignClass('right')}>{item.originCategoryName ?? '-'}</td>
      <AdminStockCategoryCell
        value={item.parentCategoryName ?? item.categoryName}
        options={categoryOptions}
        onAssign={categoryId => onAssign(item.stockCode, categoryId)}
        isHighlighted={isHighlighted}
        onHoverStart={() => onHoverStart(item.stockCode)}
        onHoverEnd={onHoverEnd}
      />
      <AdminStockCategoryCell
        value={item.parentCategoryName ? item.categoryName : '-'}
        options={categoryOptions}
        onAssign={categoryId => onAssign(item.stockCode, categoryId)}
        isHighlighted={isHighlighted}
        onHoverStart={() => onHoverStart(item.stockCode)}
        onHoverEnd={onHoverEnd}
      />
    </tr>
  )
})

export default function AdminStockTable({ items, categories }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('totalMarketValue')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [isPending, startTransition] = useTransition()

  const assignStockCategory = useAssignStockCategory()
  const bulkAssignStockCategory = useBulkAssignStockCategory()
  const updateAlias = useUpdateAlias()
  // categories가 안 바뀌면 참조를 유지해야 AdminStockRow의 React.memo가 제대로 스킵된다.
  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories])
  // 대분류/소분류 셀은 결국 같은 종목의 categoryId를 바꾸는 동일한 액션이라, 둘 중 하나만 호버해도 같이 강조되게 한다.
  const [hoveredCategoryStock, setHoveredCategoryStock] = useState<string | null>(null)
  // 필터/정렬이 바뀌어도 선택 상태는 stockCode 기준으로 유지된다 (전체선택만 "지금 보이는 것" 기준으로 동작).
  const [selectedStockCodes, setSelectedStockCodes] = useState<Set<string>>(new Set())

  const handleSort = (key: SortKey) => {
    startTransition(() => {
      if (key === sortKey) {
        setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDirection('asc')
      }
    })
  }

  // AdminStockRow에 props로 내려가는 콜백들 — 매 렌더마다 새 함수면 React.memo가 무력화되므로 useCallback으로 고정한다.
  const handleAssign = useCallback(
    (stockCode: string, categoryId: number) => {
      assignStockCategory.mutate({ stockCode, categoryId })
    },
    [assignStockCategory],
  )

  const handleUpdateAlias = useCallback(
    (stockCode: string, alias: string | null) => {
      updateAlias.mutate({ stockCode, alias })
    },
    [updateAlias],
  )

  const toggleSelected = useCallback((stockCode: string) => {
    setSelectedStockCodes(prev => {
      const next = new Set(prev)
      if (next.has(stockCode)) next.delete(stockCode)
      else next.add(stockCode)
      return next
    })
  }, [])

  const handleHoverStart = useCallback((stockCode: string) => setHoveredCategoryStock(stockCode), [])
  const handleHoverEnd = useCallback(() => setHoveredCategoryStock(null), [])

  const handleBulkAssign = (categoryId: number) => {
    bulkAssignStockCategory.mutate(
      { stockCodes: [...selectedStockCodes], categoryId },
      {
        onSuccess: result => {
          setSelectedStockCodes(new Set())
          const categoryName = categoryOptions.find(opt => opt.id === result.categoryId)?.name ?? ''
          if (result.failedStockCodes.length === 0) {
            window.alert(`카테고리: ${categoryName}\n일괄 적용 완료되었습니다.`)
          } else {
            window.alert(
              `카테고리: ${categoryName}\n다음 종목은 반영되지 않았습니다:\n${result.failedStockCodes.join(', ')}`,
            )
          }
        },
      },
    )
  }

  const [excludedFilters, setExcludedFilters] = useState<Record<FilterKey, Set<string>>>({
    market: new Set(),
    originCategoryName: new Set(),
    parentCategoryName: new Set(),
    categoryName: new Set(),
  })

  const filterOptionsByKey = useMemo(() => {
    const result = {} as Record<FilterKey, string[]>
    for (const key of FILTER_KEYS) {
      const values = new Set(items.map(DISPLAY_VALUE[key]))
      result[key] = [...values].sort((a, b) => KOREAN_COLLATOR.compare(a, b))
    }
    return result
  }, [items])

  const toggleFilterValue = (key: FilterKey, value: string) => {
    setExcludedFilters(prev => {
      const next = new Set(prev[key])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...prev, [key]: next }
    })
  }
  const selectAllFilterValues = (key: FilterKey) => {
    setExcludedFilters(prev => ({ ...prev, [key]: new Set() }))
  }
  const selectNoneFilterValues = (key: FilterKey) => {
    setExcludedFilters(prev => ({ ...prev, [key]: new Set(filterOptionsByKey[key]) }))
  }

  const filtered = useMemo(
    () => items.filter(item => FILTER_KEYS.every(key => !excludedFilters[key].has(DISPLAY_VALUE[key](item)))),
    [items, excludedFilters],
  )

  const sortedAscending = useMemo(
    () => [...filtered].sort((a, b) => compareByKey(a, b, sortKey)),
    [filtered, sortKey],
  )

  const sorted = useMemo(
    () => (sortDirection === 'asc' ? sortedAscending : [...sortedAscending].reverse()),
    [sortedAscending, sortDirection],
  )

  // 전체선택은 항상 "지금 필터링돼서 보이는" 종목만 대상으로 한다. 개별 체크는 필터가 바뀌어도 유지된다.
  const isAllVisibleSelected = sorted.length > 0 && sorted.every(item => selectedStockCodes.has(item.stockCode))
  const toggleSelectAllVisible = () => {
    setSelectedStockCodes(prev => {
      const next = new Set(prev)
      if (isAllVisibleSelected) {
        for (const item of sorted) next.delete(item.stockCode)
      } else {
        for (const item of sorted) next.add(item.stockCode)
      }
      return next
    })
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-2">
        <p className="text-sm font-bold text-white">
          종목 목록 ({sorted.length}
          {sorted.length !== items.length ? ` / ${items.length}` : ''})
        </p>
        {selectedStockCodes.size > 0 && (
          <BulkAssignButton count={selectedStockCodes.size} options={categoryOptions} onAssign={handleBulkAssign} />
        )}
      </div>
      <div className="overflow-x-auto scrollbar-hide">
        <table className="nes-table is-dark is-bordered w-full text-sm [&_td]:py-0.5 [&_th]:py-1">
          <thead>
            <tr>
              <th className="bg-[#4f8fd6] text-center" style={{ width: CHECKBOX_COLUMN_WIDTH }}>
                <input type="checkbox" checked={isAllVisibleSelected} onChange={toggleSelectAllVisible} />
              </th>
              <th className="bg-[#4f8fd6] text-center" style={{ width: NUMBER_COLUMN_WIDTH }}>
                #
              </th>
              {COLUMNS.map(col => {
                const label = (
                  <span className="cursor-pointer select-none hover:text-yellow-400" onClick={() => handleSort(col.key)}>
                    {col.header}
                    {sortKey === col.key && (
                      <span className="ml-1 text-gray-400">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </span>
                )
                // col.key로 좁혀진 타입은 아래 클로저(onToggle 등) 안에서는 다시 넓어지므로, 지역 변수로 한 번 고정해둔다.
                const filterKey = isFilterKey(col.key) ? col.key : null
                return (
                  <th key={col.key} style={{ width: col.width }} className="whitespace-nowrap bg-[#4f8fd6] text-center">
                    {filterKey ? (
                      <div className="flex items-center justify-between pl-2 pr-1">
                        {label}
                        <AdminColumnFilterButton
                          options={filterOptionsByKey[filterKey]}
                          excluded={excludedFilters[filterKey]}
                          onToggle={value => toggleFilterValue(filterKey, value)}
                          onSelectAll={() => selectAllFilterValues(filterKey)}
                          onSelectNone={() => selectNoneFilterValues(filterKey)}
                        />
                      </div>
                    ) : (
                      label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="p-8">
                  <div className="flex justify-center">
                    <Spinner />
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((item, index) => (
                <AdminStockRow
                  key={item.stockCode}
                  item={item}
                  index={index}
                  isSelected={selectedStockCodes.has(item.stockCode)}
                  onToggleSelected={toggleSelected}
                  isHighlighted={hoveredCategoryStock === item.stockCode}
                  onHoverStart={handleHoverStart}
                  onHoverEnd={handleHoverEnd}
                  categoryOptions={categoryOptions}
                  onAssign={handleAssign}
                  onUpdateAlias={handleUpdateAlias}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
