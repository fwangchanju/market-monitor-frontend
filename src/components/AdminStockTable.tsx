import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { CategoryItem, MarketValueTier, StockCategoryListItem } from '@/types/api'
import { toFullDateTimeLabel, toJoEokDecimal } from '@/utils/format'
import { MARKET_VALUE_TIER_OPTIONS } from '@/utils/marketValueTier'
import { useAssignStockCategory, useBulkAssignStockCategory, useUpdateAlias } from '@/hooks/useMarketMapAdmin'
import Spinner from './Spinner'
import { CheckIcon, SearchIcon } from './icons/MarketMapIcons'

interface Props {
  items: StockCategoryListItem[]
  categories: CategoryItem[]
  snapshotTime: string | null
}

type SortKey =
  | 'stockCode'
  | 'market'
  | 'stockName'
  | 'alias'
  | 'totalMarketValue'
  | 'originCategoryName'
  | 'parentCategoryName'
  | 'midCategoryName'
  | 'subCategoryName'
type SortDirection = 'asc' | 'desc'

const NUMBER_COLUMN_WIDTH = '5%'
const CHECKBOX_COLUMN_WIDTH = '3%'

const COLUMNS: { key: SortKey; header: string; width: string; align: 'center' | 'left' | 'right' }[] = [
  { key: 'stockCode', header: '종목코드', width: '7%', align: 'left' },
  { key: 'stockName', header: '종목명', width: '10%', align: 'left' },
  { key: 'alias', header: '표시명 (약칭)', width: '8%', align: 'left' },
  { key: 'totalMarketValue', header: '시가총액', width: '10%', align: 'right' },
  { key: 'market', header: '마켓', width: '7%', align: 'center' },
  { key: 'originCategoryName', header: '거래소 분류', width: '11%', align: 'left' },
  { key: 'parentCategoryName', header: '1차 분류', width: '11%', align: 'right' },
  { key: 'midCategoryName', header: '2차 분류', width: '11%', align: 'right' },
  { key: 'subCategoryName', header: '3차 분류', width: '11%', align: 'right' },
]

const alignClass = (align: 'center' | 'left' | 'right') =>
  align === 'right' ? 'text-right pr-4' : align === 'left' ? 'text-left pl-4' : 'text-center'

const MARKET_LABEL: Record<'KOSPI' | 'KOSDAQ', string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
const MARKET_FILTER_ORDER = [MARKET_LABEL.KOSPI, MARKET_LABEL.KOSDAQ]
const marketColorClass = (market: 'KOSPI' | 'KOSDAQ') => (market === 'KOSPI' ? 'text-gray-400' : 'text-[#4f8fd6]')

const KOREAN_COLLATOR = new Intl.Collator('ko')

// 화면에 실제로 표시되는 값 기준 — 필터 옵션 목록/필터링/정렬 판정 전부 이 값으로 통일해서 화면과 어긋나지 않게 한다.
type FilterKey = 'market' | 'originCategoryName' | 'parentCategoryName' | 'midCategoryName' | 'subCategoryName'
const FILTER_KEYS: readonly FilterKey[] = [
  'market',
  'originCategoryName',
  'parentCategoryName',
  'midCategoryName',
  'subCategoryName',
]

function isFilterKey(key: SortKey): key is FilterKey {
  return (FILTER_KEYS as readonly string[]).includes(key)
}

function compareByKey(
  a: StockCategoryListItem,
  b: StockCategoryListItem,
  key: SortKey,
  displayByStockCode: Map<string, ItemDisplayValues>,
): number {
  if (key === 'totalMarketValue') {
    return (a.totalMarketValue ?? -Infinity) - (b.totalMarketValue ?? -Infinity)
  }
  if (isFilterKey(key)) {
    const av = displayByStockCode.get(a.stockCode)?.[key] ?? ''
    const bv = displayByStockCode.get(b.stockCode)?.[key] ?? ''
    return KOREAN_COLLATOR.compare(av, bv)
  }
  return KOREAN_COLLATOR.compare(a[key] ?? '', b[key] ?? '')
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

// 종목 응답엔 categoryId(실제 배정된 카테고리, 뎁스 무관)만 있어서, 대분류/중분류/소분류 3칸에 어떻게
// 나눠 보여줄지는 이미 받아온 카테고리 트리를 parentId로 거슬러 올라가며 프론트에서 직접 계산한다.
// 백엔드가 뎁스별 이름 필드를 따로 내려줄 필요가 없어서, 나중에 뎁스가 더 늘어나도 여기만 고치면 된다.
interface CategoryChain {
  rootId: number | null
  rootName: string
  midId: number | null
  midName: string | null
  leafId: number | null
  leafName: string | null
}

function resolveCategoryChain(categoryOptionsById: Map<number, CategoryOption>, categoryId: number): CategoryChain {
  const chain: CategoryOption[] = []
  let current = categoryOptionsById.get(categoryId)
  while (current) {
    chain.unshift(current)
    current = current.parentId != null ? categoryOptionsById.get(current.parentId) : undefined
  }
  return {
    rootId: chain[0]?.id ?? null,
    rootName: chain[0]?.name ?? '-',
    midId: chain[1]?.id ?? null,
    midName: chain[1]?.name ?? null,
    leafId: chain[2]?.id ?? null,
    leafName: chain[2]?.name ?? null,
  }
}

interface ItemDisplayValues {
  market: string
  originCategoryName: string
  parentCategoryName: string
  midCategoryName: string
  subCategoryName: string
}

function computeDisplayValues(item: StockCategoryListItem, categoryOptionsById: Map<number, CategoryOption>): ItemDisplayValues {
  const chain = resolveCategoryChain(categoryOptionsById, item.categoryId)
  return {
    market: MARKET_LABEL[item.market],
    originCategoryName: item.originCategoryName ?? '-',
    parentCategoryName: chain.rootName,
    midCategoryName: chain.midName ?? '-',
    subCategoryName: chain.leafName ?? '-',
  }
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref는 안정적이라 open 시점에만 반응하면 된다
  }, [isOpen])

  // 처음 여는 순간엔 이 컴포넌트가 처음 렌더될 때라 position이 아직 null이라 팝업(및 입력창) 자체가
  // DOM에 없다 — 그 상태에서 onOpen(주로 input.focus())을 호출하면 허공에 걸린다. position이 실제로
  // 채워져서 팝업이 DOM에 나타난 뒤에 따로 포커스를 걸어야, 처음 여는 경우에도 커서가 제대로 간다.
  useEffect(() => {
    if (isOpen && position) onOpen?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onOpen은 매 렌더 새 함수라 deps에 넣으면 무한루프
  }, [isOpen, position])

  useEffect(() => {
    if (!isOpen) return

    const close = () => setIsOpen(false)
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    // capture 없이 window 자체의 scroll(페이지 스크롤)만 감지 — capture:true였으면
    // 팝업 내부 목록의 overflow-y-auto 스크롤까지 잡혀서 즉시 닫혀버림.
    window.addEventListener('scroll', close)
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
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
  contextLabel,
}: {
  popupRef: React.RefObject<HTMLDivElement | null>
  inputRef: React.RefObject<HTMLInputElement | null>
  position: PopupPosition
  search: ReturnType<typeof useCategorySearchState>
  onSelect: (categoryId: number) => void
  onEscape: () => void
  // 소분류 팝업처럼 목록이 특정 대분류로 좁혀져 있을 때, 지금 어느 대분류 밑을 보고 있는지 알려주는 칩.
  contextLabel?: string
}) {
  // 방향키로 하이라이트가 화면 밖으로 나가면 스크롤이 안 따라가서 지금 뭐가 선택됐는지 안 보이는
  // 문제가 있었다 — 하이라이트된 항목의 DOM 노드를 등록해뒀다가, 바뀔 때마다 보이는 영역으로 스크롤한다.
  const optionRefs = useRef(new Map<number, HTMLButtonElement>())
  useEffect(() => {
    optionRefs.current.get(search.highlightedIndex)?.scrollIntoView({ block: 'nearest' })
  }, [search.highlightedIndex])

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
        className="nes-input is-dark w-full py-2 text-[18px]"
      />
      {contextLabel && (
        <span className="mt-2 inline-block rounded bg-[#4f8fd6]/30 px-2 py-0.5 text-[14px] text-white">
          {contextLabel}
        </span>
      )}
      <div className="mt-2 border-t border-gray-600 pt-2">
        <div className="max-h-72 overflow-y-auto">
          {search.matches.length === 0 ? (
            <p className="px-2 py-1 text-[18px] text-gray-400">검색 결과가 없습니다</p>
          ) : (
            search.matches.map((opt, index) => (
              <button
                key={opt.id}
                ref={el => {
                  if (el) optionRefs.current.set(index, el)
                  else optionRefs.current.delete(index)
                }}
                type="button"
                onClick={() => onSelect(opt.id)}
                onMouseEnter={() => search.setHighlightedIndex(index)}
                className={`block w-full truncate rounded px-2 py-1 text-left text-[18px] text-white ${
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
  rowHoverClass,
  onHoverStart,
  onHoverEnd,
  onEditingChange,
  contextLabel,
  disabled,
  disabledHint,
}: {
  value: string
  options: CategoryOption[]
  onAssign: (categoryId: number) => void
  isHighlighted: boolean
  rowHoverClass: string
  onHoverStart: () => void
  onHoverEnd: () => void
  onEditingChange: (editing: boolean) => void
  contextLabel?: string
  // 예: 중분류가 아직 지정 안 된 상태의 소분류 셀 — 고를 수 있는 범위 자체가 없으니 클릭해도 팝업을 안 띄운다.
  disabled?: boolean
  // disabled일 때 클릭하면 1.5초간 떴다가 자동으로 사라지는 안내 문구.
  disabledHint?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const cellRef = useRef<HTMLTableCellElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const search = useCategorySearchState(options, isOpen)

  // 셀 위치에 맞춰 펼치면 화면 오른쪽 끝에서 잘릴 걱정을 해야 해서, 그냥 화면 상단 중앙에 고정으로 띄운다.
  const showDisabledHint = (e: React.MouseEvent<HTMLTableCellElement>) => {
    e.stopPropagation()
    if (!disabledHint) return
    setShowHint(true)
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current)
    hintTimeoutRef.current = setTimeout(() => setShowHint(false), 1000)
  }

  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current)
    }
  }, [])

  // 바깥 클릭/스크롤로 닫힐 때도(usePopupPosition 내부에서 직접 호출) 항상 이 함수를 거치도록,
  // 팝업 열림 상태를 바꾸는 지점을 하나로 모은다 — 그래야 행 하이라이트(onEditingChange)가 항상 같이 갱신된다.
  const updateOpen = (open: boolean) => {
    setIsOpen(open)
    onEditingChange(open)
    // 팝업이 열려있는 동안 마우스가 밖으로 나가도(예: 검색 목록 클릭) 진한 컬럼 강조가 그대로 남지 않도록 끈다.
    if (open) onHoverEnd()
  }

  // 카테고리 목록 팝업은 세로로 훨씬 커져서(약 12개 높이), 기본 임계값(80%)보다 일찍 위로 뒤집어야 화면 밖으로 안 잘린다.
  // 대분류/소분류는 테이블 우측에 몰려있어 오른쪽으로 열면 화면 밖으로 잘리므로, 필터 팝업과 동일하게
  // 셀 우측 끝에 맞춰 왼쪽으로 열리게 한다.
  const position = usePopupPosition(isOpen, updateOpen, cellRef, popupRef, () => inputRef.current?.focus(), 0.6, true)

  const handleSelect = (categoryId: number) => {
    onAssign(categoryId)
    updateOpen(false)
  }

  return (
    <td
      ref={cellRef}
      className={`pl-4 text-left ${disabled ? 'cursor-default text-gray-500' : 'cursor-pointer'} ${
        isHighlighted ? 'bg-yellow-400/50' : rowHoverClass
      }`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={
        disabled
          ? showDisabledHint
          : e => {
              // 행 전체 클릭 시 체크박스가 토글되는 동작(AdminStockRow)과 별개로 동작해야 하므로 버블링을 막는다.
              e.stopPropagation()
              search.reset()
              updateOpen(true)
            }
      }
    >
      {value}
      {!disabled && isOpen && position && (
        <CategorySearchPopup
          popupRef={popupRef}
          inputRef={inputRef}
          position={position}
          search={search}
          onSelect={handleSelect}
          onEscape={() => updateOpen(false)}
          contextLabel={contextLabel}
        />
      )}
      {disabled && showHint && (
        <div
          style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)' }}
          className="nes-container is-dark z-50 whitespace-nowrap !bg-violet-950 px-3 py-2 text-[18px] text-white"
        >
          {disabledHint}
        </div>
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
  isHighlighted,
  rowHoverClass,
  onHoverStart,
  onHoverEnd,
  onEditingChange,
}: {
  alias: string | null
  onUpdate: (alias: string | null) => void
  isHighlighted: boolean
  rowHoverClass: string
  onHoverStart: () => void
  onHoverEnd: () => void
  onEditingChange: (editing: boolean) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState('')

  const startEdit = () => {
    setValue(alias ?? '')
    setIsEditing(true)
    onEditingChange(true)
    // 입력창으로 바뀌면서 이 <td>가 통째로 사라지므로, onMouseLeave가 못 불리기 전에 직접 강조를 꺼준다.
    onHoverEnd()
  }

  const stopEdit = () => {
    setIsEditing(false)
    onEditingChange(false)
  }

  const submit = () => {
    const trimmed = value.trim()
    const next = trimmed === '' ? null : trimmed
    stopEdit()
    if (next === alias) return
    onUpdate(next)
  }

  if (isEditing) {
    return (
      <td className={`${alignClass('left')} ${rowHoverClass}`} onClick={e => e.stopPropagation()}>
        <input
          type="text"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={stopEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') stopEdit()
          }}
          className="nes-input is-dark w-full text-left text-xs"
        />
      </td>
    )
  }

  return (
    <td
      className={`cursor-pointer text-white ${alignClass('left')} ${isHighlighted ? 'bg-yellow-400/50' : rowHoverClass}`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={e => {
        // 행 전체 클릭 시 체크박스가 토글되는 동작(AdminStockRow)과 별개로 동작해야 하므로 버블링을 막는다.
        e.stopPropagation()
        startEdit()
      }}
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
  onSelectOnly,
}: {
  options: string[]
  excluded: Set<string>
  onToggle: (value: string) => void
  onSelectAll: () => void
  onSelectNone: () => void
  onSelectOnly: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isFiltered = excluded.size > 0

  // 필터 버튼이 팝업의 좌측이 아니라 우측 끝이 되도록(팝업이 왼쪽으로 펼쳐지도록) alignRight로 연다.
  const position = usePopupPosition(isOpen, setIsOpen, buttonRef, popupRef, () => inputRef.current?.focus(), 0.8, true)

  const isAllSelected = excluded.size === 0
  const handleToggleAll = () => {
    if (isAllSelected) onSelectNone()
    else onSelectAll()
  }

  // 목록/선택 방식은 그대로 두고, 검색어로 화면에 보이는 체크박스만 좁혀서 보여준다.
  const trimmed = query.trim().toLowerCase()
  const visibleOptions = trimmed ? options.filter(opt => opt.toLowerCase().includes(trimmed)) : options

  // 아직 아무것도 제외 안 한(전체선택) 상태에서 검색 중이면, 실제 상태는 그대로 두고 화면에서만
  // "전체"/검색 결과가 체크 해제된 것처럼 보여준다(엑셀 필터 검색과 동일). 이 상태에서 검색 결과 하나를
  // 체크하면 "이것만 남기기"로 동작해서, 검색 후 클릭 한 번으로 원하는 값만 필터링할 수 있게 한다.
  const isPreviewingSearch = isAllSelected && trimmed !== ''
  const handleToggleOption = (opt: string) => {
    if (isPreviewingSearch) onSelectOnly(opt)
    else onToggle(opt)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={e => {
          e.stopPropagation()
          setQuery('')
          setIsOpen(prev => !prev)
        }}
        className={`rounded bg-transparent px-1 normal-case ${isFiltered ? 'text-[#ffee00]' : 'text-white/70 hover:text-white'}`}
        title="필터"
      >
        <CheckIcon className="h-3.5 w-3.5" strokeWidth={6} />
      </button>
      {isOpen && position && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            transform: `translate(${position.alignRight ? '-100%' : '0'}, ${position.openUpward ? '-100%' : '0'})`,
          }}
          className="nes-container is-dark z-50 w-64 !bg-violet-950 p-2 text-left normal-case"
          onClick={e => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="검색"
            className="nes-input is-dark mb-2 w-full py-2 text-[18px]"
          />
          <label className="flex cursor-pointer items-center gap-1.5 rounded border-b border-gray-600 px-1 py-1 text-[18px] font-bold text-white hover:bg-yellow-400/50">
            <input type="checkbox" checked={!isPreviewingSearch && isAllSelected} onChange={handleToggleAll} />
            <span>전체</span>
          </label>
          <div className="max-h-48 overflow-y-auto pt-1">
            {visibleOptions.map(opt => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[18px] text-white hover:bg-yellow-400/50"
              >
                <input
                  type="checkbox"
                  checked={!isPreviewingSearch && !excluded.has(opt)}
                  onChange={() => handleToggleOption(opt)}
                />
                <span className="truncate">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  )
}


// 시가총액 구간 필터. 다른 컬럼 필터(AdminColumnFilterButton)와 동일하게 "기본 전체 포함,
// 체크 해제로 제외"하는 다중선택 방식이라 대형주+중형주처럼 여러 구간을 동시에 볼 수 있다.
// 값 종류가 고정된 4개뿐이라 검색 입력 없이 목록만 보여준다.
function AdminMarketValueFilterButton({
  excluded,
  onToggle,
  onSelectAll,
  onSelectNone,
}: {
  excluded: Set<MarketValueTier>
  onToggle: (value: MarketValueTier) => void
  onSelectAll: () => void
  onSelectNone: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const isFiltered = excluded.size > 0
  const isAllSelected = excluded.size === 0

  const position = usePopupPosition(isOpen, setIsOpen, buttonRef, popupRef, undefined, 0.8, true)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={e => {
          e.stopPropagation()
          setIsOpen(prev => !prev)
        }}
        className={`rounded bg-transparent px-1 normal-case ${isFiltered ? 'text-[#ffee00]' : 'text-white/70 hover:text-white'}`}
        title="필터"
      >
        <CheckIcon className="h-3.5 w-3.5" strokeWidth={6} />
      </button>
      {isOpen && position && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            transform: `translate(${position.alignRight ? '-100%' : '0'}, ${position.openUpward ? '-100%' : '0'})`,
          }}
          className="nes-container is-dark z-50 w-64 !bg-violet-950 p-2 text-left normal-case"
          onClick={e => e.stopPropagation()}
        >
          <label className="flex cursor-pointer items-center gap-1.5 rounded border-b border-gray-600 px-1 py-1 text-[18px] font-bold text-white hover:bg-yellow-400/50">
            <input type="checkbox" checked={isAllSelected} onChange={() => (isAllSelected ? onSelectNone() : onSelectAll())} />
            <span>전체</span>
          </label>
          <div className="pt-1">
            {MARKET_VALUE_TIER_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className="flex w-full cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[18px] text-white hover:bg-yellow-400/50"
              >
                <input type="checkbox" checked={!excluded.has(opt.value)} onChange={() => onToggle(opt.value)} />
                <span className="flex flex-1 items-center justify-between gap-2">
                  <span>{opt.label}</span>
                  <span className="text-gray-500">{opt.range}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// 종목명 검색 필터. 다른 필터(업종/대분류/소분류/마켓)와 달리 "기본 전체 포함, 체크 해제로 제외"가 아니라
// "기본 필터 없음, 검색해서 선택한 종목만 남기기"로 동작한다 — 값의 종류가 2700여 개라 체크박스 목록으로
// 보여줄 수 없고 검색이 필요하기 때문. 검색어가 비어있으면 위 결과 섹션은 아무것도 보여주지 않는다.
function AdminStockNameFilterButton({
  items,
  selected,
  onToggle,
  onClear,
}: {
  items: StockCategoryListItem[]
  selected: Set<string>
  onToggle: (stockCode: string) => void
  onClear: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef(new Map<number, HTMLButtonElement>())
  const isFiltered = selected.size > 0

  const position = usePopupPosition(isOpen, setIsOpen, buttonRef, popupRef, () => inputRef.current?.focus(), 0.8, true)

  const trimmed = query.trim().toLowerCase()
  const matches = trimmed
    ? items.filter(
        item =>
          (item.stockName.toLowerCase().includes(trimmed) || item.stockCode.includes(trimmed)) &&
          !selected.has(item.stockCode),
      )
    : []
  const selectedItems = items.filter(item => selected.has(item.stockCode))

  useEffect(() => {
    optionRefs.current.get(highlightedIndex)?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setHighlightedIndex(-1)
  }

  const handleClearAll = () => {
    if (selectedItems.length === 0) return
    if (window.confirm(`선택된 ${selectedItems.length}개 종목의 필터를 모두 제거하시겠습니까?`)) onClear()
  }

  // Enter: 방향키로 고른 종목 하나만 추가. Ctrl+Enter: 검색어에 매칭된 종목 전부 한 번에 추가
  // (예: "삼성"까지만 치고 계열사 전부 담기). Ctrl+Shift+Enter: 선택된 종목 전체 제거.
  // 스페이스는 검색어에 공백을 칠 수도 있어야 해서 안 씀.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (matches.length === 0) return
      setHighlightedIndex(i => (i < 0 ? 0 : (i + 1) % matches.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (matches.length === 0) return
      setHighlightedIndex(i => (i <= 0 ? matches.length - 1 : i - 1))
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault()
      handleClearAll()
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      for (const item of matches) onToggle(item.stockCode)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = matches[highlightedIndex]
      if (target) onToggle(target.stockCode)
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={e => {
          e.stopPropagation()
          setQuery('')
          setHighlightedIndex(-1)
          setIsOpen(prev => !prev)
        }}
        className={`rounded bg-transparent px-1 normal-case ${isFiltered ? 'text-[#ffee00]' : 'text-white/70 hover:text-white'}`}
        title="필터"
      >
        <SearchIcon className="h-3.5 w-3.5" strokeWidth={6} />
      </button>
      {isOpen && position && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            transform: `translate(${position.alignRight ? '-100%' : '0'}, ${position.openUpward ? '-100%' : '0'})`,
          }}
          className="nes-container is-dark z-50 w-64 !bg-violet-950 p-2 text-left normal-case"
          onClick={e => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="종목명/코드 검색"
            className="nes-input is-dark w-full py-2 text-[18px]"
          />
          <div className="mt-2 max-h-56 overflow-y-auto">
            {trimmed !== '' && matches.length > 0 && (
              <button
                type="button"
                onClick={() => matches.forEach(item => onToggle(item.stockCode))}
                className="nes-btn sticky top-0 z-10 mb-2 flex w-full items-center justify-between border-violet-500 bg-violet-500 px-2 py-0.5 text-left text-xs text-white hover:bg-violet-600"
              >
                <span>전체추가({matches.length})</span>
                <span className="text-white">Ctrl+Enter</span>
              </button>
            )}
            {trimmed === '' ? null : matches.length === 0 ? (
              <p className="px-1 text-[18px] text-gray-400">검색 결과 없음</p>
            ) : (
              matches.map((item, index) => (
                <button
                  key={item.stockCode}
                  ref={el => {
                    if (el) optionRefs.current.set(index, el)
                    else optionRefs.current.delete(index)
                  }}
                  type="button"
                  onClick={() => onToggle(item.stockCode)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex w-full items-center justify-between rounded px-1 py-0.5 text-left text-[18px] text-white ${
                    index === highlightedIndex ? 'bg-yellow-400/50' : 'bg-transparent'
                  }`}
                >
                  <span className="truncate">{item.stockName}</span>
                  <span className="ml-1.5 shrink-0 text-gray-500">{item.stockCode}</span>
                </button>
              ))
            )}
          </div>
          <div className="my-2 border-b border-gray-600" />
          <div className="max-h-32 overflow-y-auto">
            {selectedItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="nes-btn sticky top-0 z-10 mb-2 flex w-full items-center justify-between border-violet-500 bg-violet-500 px-2 py-0.5 text-left text-xs text-white hover:bg-violet-600"
              >
                <span>전체제거({selectedItems.length})</span>
                <span className="text-white">Ctrl+Shift+Enter</span>
              </button>
            )}
            {selectedItems.length === 0 ? (
              <p className="px-1 text-[18px] text-gray-400">선택된 종목 없음</p>
            ) : (
              selectedItems.map(item => (
                <button
                  key={item.stockCode}
                  type="button"
                  onClick={() => onToggle(item.stockCode)}
                  className="flex w-full items-center justify-between rounded bg-transparent px-1 py-0.5 text-left text-[18px] text-yellow-400 hover:bg-yellow-400/20"
                >
                  <span className="truncate">{item.stockName}</span>
                  <span className="ml-1.5 shrink-0 text-gray-500">{item.stockCode}</span>
                </button>
              ))
            )}
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
  hoveredKind,
  onParentCategoryHoverStart,
  onMidCategoryHoverStart,
  onSubCategoryHoverStart,
  onAliasHoverStart,
  onHoverEnd,
  categoryOptions,
  categoryOptionsById,
  onAssign,
  onUpdateAlias,
}: {
  item: StockCategoryListItem
  index: number
  isSelected: boolean
  onToggleSelected: (stockCode: string) => void
  hoveredKind: 'parentCategory' | 'midCategory' | 'subCategory' | 'alias' | null
  onParentCategoryHoverStart: (stockCode: string) => void
  onMidCategoryHoverStart: (stockCode: string) => void
  onSubCategoryHoverStart: (stockCode: string) => void
  onAliasHoverStart: (stockCode: string) => void
  onHoverEnd: () => void
  categoryOptions: CategoryOption[]
  categoryOptionsById: Map<number, CategoryOption>
  onAssign: (stockCode: string, categoryId: number) => void
  onUpdateAlias: (stockCode: string, alias: string | null) => void
}) {
  // 행 어디에 마우스를 올려도(체크박스/#/시가총액 등 포함) 줄 전체가 옅게 강조되고, 대분류/소분류/약칭
  // 중 하나를 hover 중일 때는 그 열만 추가로 진하게 표시해서 어떤 걸 hover 중인지 구분되게 한다.
  // 체크박스로 선택된 행도 hover 중이 아니어도 항상 동일한 옅은 강조를 유지한다.
  const [isRowHovered, setIsRowHovered] = useState(false)
  // 약칭 수정 중이거나 대분류/소분류 검색 팝업이 열려있는 동안은, 마우스가 그 행 위에 없어도
  // (예: 입력하다가 다른 곳으로 시선이 옮겨간 경우) 지금 어느 행을 수정 중인지 계속 보이도록 강조를 유지한다.
  const [editingCells, setEditingCells] = useState<Set<'alias' | 'category1' | 'category2' | 'category3'>>(new Set())
  const setCellEditing = (key: 'alias' | 'category1' | 'category2' | 'category3', editing: boolean) => {
    setEditingCells(prev => {
      const next = new Set(prev)
      if (editing) next.add(key)
      else next.delete(key)
      return next
    })
  }
  const rowHoverClass = isRowHovered || isSelected || editingCells.size > 0 ? 'bg-yellow-400/20' : ''

  // 대분류 팝업엔 최상위 카테고리만, 중분류 팝업엔 "지금 이 종목의 대분류"의 자식만, 소분류 팝업엔
  // "지금 이 종목의 중분류"의 자식만 보여준다. categoryId(실제 배정된 카테고리)를 parentId로 거슬러
  // 올라가서 전체 조상 체인을 구한 뒤, 뎁스별로 슬롯에 나눠 담는다.
  const chain = resolveCategoryChain(categoryOptionsById, item.categoryId)
  const parentCategoryOptions = categoryOptions.filter(opt => opt.parentId === null)
  // 이미 한 단계 위로 좁혀진 목록이라 "- " 들여쓰기 접두어가 필요 없다 — 그냥 이름 그대로 보여준다.
  const midCategoryOptions = categoryOptions
    .filter(opt => opt.parentId === chain.rootId)
    .map(opt => ({ ...opt, label: opt.name }))
  const subCategoryOptions =
    chain.midId != null
      ? categoryOptions.filter(opt => opt.parentId === chain.midId).map(opt => ({ ...opt, label: opt.name }))
      : []

  // 체크박스를 정확히 조준하지 않아도, hover 강조가 뜨는 영역(약칭/대분류/소분류 제외 전체) 아무 곳이나
  // 클릭하면 체크가 토글되게 한다. 약칭/대분류/소분류 셀은 자기 클릭(stopPropagation)으로 배제되고,
  // 체크박스 자신을 클릭한 경우는 onChange가 이미 처리하므로 여기서 중복 토글하지 않는다.
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    onToggleSelected(item.stockCode)
  }

  return (
    <tr onClick={handleRowClick} onMouseEnter={() => setIsRowHovered(true)} onMouseLeave={() => setIsRowHovered(false)}>
      <td className={`text-center ${rowHoverClass}`}>
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelected(item.stockCode)} />
      </td>
      <td className={`text-center text-gray-400 ${rowHoverClass}`}>{index + 1}</td>
      <td className={`${alignClass('left')} text-gray-400 ${rowHoverClass}`}>{item.stockCode}</td>
      <td className={`${alignClass('left')} text-gray-400 ${rowHoverClass}`}>{item.stockName}</td>
      <AdminAliasCell
        alias={item.alias}
        onUpdate={alias => onUpdateAlias(item.stockCode, alias)}
        isHighlighted={hoveredKind === 'alias'}
        rowHoverClass={rowHoverClass}
        onHoverStart={() => onAliasHoverStart(item.stockCode)}
        onHoverEnd={onHoverEnd}
        onEditingChange={editing => setCellEditing('alias', editing)}
      />
      <td className={`${alignClass('right')} text-gray-400 ${rowHoverClass}`}>
        {item.totalMarketValue != null ? toJoEokDecimal(item.totalMarketValue / 100_000_000) : '-'}
      </td>
      <td className={`text-center ${marketColorClass(item.market)} ${rowHoverClass}`}>{MARKET_LABEL[item.market]}</td>
      <td className={`${alignClass('left')} text-gray-400 ${rowHoverClass}`}>{item.originCategoryName ?? '-'}</td>
      <AdminStockCategoryCell
        value={chain.rootName}
        options={parentCategoryOptions}
        onAssign={categoryId => onAssign(item.stockCode, categoryId)}
        isHighlighted={hoveredKind === 'parentCategory'}
        rowHoverClass={rowHoverClass}
        onHoverStart={() => onParentCategoryHoverStart(item.stockCode)}
        onHoverEnd={onHoverEnd}
        onEditingChange={editing => setCellEditing('category1', editing)}
      />
      <AdminStockCategoryCell
        value={chain.midName ?? '-'}
        options={midCategoryOptions}
        onAssign={categoryId => onAssign(item.stockCode, categoryId)}
        isHighlighted={hoveredKind === 'midCategory'}
        rowHoverClass={rowHoverClass}
        onHoverStart={() => onMidCategoryHoverStart(item.stockCode)}
        onHoverEnd={onHoverEnd}
        onEditingChange={editing => setCellEditing('category2', editing)}
        contextLabel={chain.rootName}
      />
      <AdminStockCategoryCell
        value={chain.leafName ?? '-'}
        options={subCategoryOptions}
        onAssign={categoryId => onAssign(item.stockCode, categoryId)}
        isHighlighted={hoveredKind === 'subCategory'}
        rowHoverClass={rowHoverClass}
        onHoverStart={() => onSubCategoryHoverStart(item.stockCode)}
        onHoverEnd={onHoverEnd}
        onEditingChange={editing => setCellEditing('category3', editing)}
        contextLabel={chain.midName ?? undefined}
        disabled={chain.midId == null}
        disabledHint="2차 분류를 먼저 지정하세요"
      />
    </tr>
  )
})

export default function AdminStockTable({ items, categories, snapshotTime }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('totalMarketValue')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [isPending, startTransition] = useTransition()
  // 헤더가 sticky + 스크롤 컨테이너(overflow-auto) 안에 있어서, 그 위로 뜨는 툴팁은 일반 absolute로는
  // 부모의 overflow에 잘린다 — body에 포털로 그려서 잘리지 않게 한다(MarketMapBox 등과 동일한 패턴).
  const [snapshotTooltipPos, setSnapshotTooltipPos] = useState<{ left: number; top: number } | null>(null)

  const assignStockCategory = useAssignStockCategory()
  const bulkAssignStockCategory = useBulkAssignStockCategory()
  const updateAlias = useUpdateAlias()
  // categories가 안 바뀌면 참조를 유지해야 AdminStockRow의 React.memo가 제대로 스킵된다.
  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories])
  const categoryOptionsById = useMemo(() => new Map(categoryOptions.map(opt => [opt.id, opt])), [categoryOptions])
  // 필터/정렬/컬럼 표시에 쓰는 대분류·중분류·소분류 문자열을 종목마다 한 번씩만 미리 계산해둔다.
  const displayByStockCode = useMemo(
    () => new Map(items.map(item => [item.stockCode, computeDisplayValues(item, categoryOptionsById)])),
    [items, categoryOptionsById],
  )
  // 대분류/중분류/소분류는 이제 각각 별도로 assign 요청을 보내는 독립된 액션이라, 셀마다 따로 강조한다.
  const [hoveredRow, setHoveredRow] = useState<{
    stockCode: string
    kind: 'parentCategory' | 'midCategory' | 'subCategory' | 'alias'
  } | null>(null)
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

  const handleParentCategoryHoverStart = useCallback(
    (stockCode: string) => setHoveredRow({ stockCode, kind: 'parentCategory' }),
    [],
  )
  const handleMidCategoryHoverStart = useCallback(
    (stockCode: string) => setHoveredRow({ stockCode, kind: 'midCategory' }),
    [],
  )
  const handleSubCategoryHoverStart = useCallback(
    (stockCode: string) => setHoveredRow({ stockCode, kind: 'subCategory' }),
    [],
  )
  const handleAliasHoverStart = useCallback((stockCode: string) => setHoveredRow({ stockCode, kind: 'alias' }), [])
  const handleHoverEnd = useCallback(() => setHoveredRow(null), [])

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
    midCategoryName: new Set(),
    subCategoryName: new Set(),
  })
  // 종목명 필터는 다른 필터와 반대로 "선택한 종목코드만 남기기"(포함 방식)로 동작한다. 비어있으면 필터 없음.
  const [nameFilterStockCodes, setNameFilterStockCodes] = useState<Set<string>>(new Set())
  const [excludedMarketValueTiers, setExcludedMarketValueTiers] = useState<Set<MarketValueTier>>(new Set())
  const toggleMarketValueTier = (value: MarketValueTier) => {
    setExcludedMarketValueTiers(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }
  const toggleNameFilterStockCode = (stockCode: string) => {
    setNameFilterStockCodes(prev => {
      const next = new Set(prev)
      if (next.has(stockCode)) next.delete(stockCode)
      else next.add(stockCode)
      return next
    })
  }

  // 컬럼 필터(시장/업종/1~3차 분류) + 종목명 검색 + 시가총액 구간까지 전부 한 번에 초기화.
  const hasAnyFilter =
    FILTER_KEYS.some(key => excludedFilters[key].size > 0) ||
    nameFilterStockCodes.size > 0 ||
    excludedMarketValueTiers.size > 0
  const handleClearAllFilters = () => {
    setExcludedFilters({
      market: new Set(),
      originCategoryName: new Set(),
      parentCategoryName: new Set(),
      midCategoryName: new Set(),
      subCategoryName: new Set(),
    })
    setNameFilterStockCodes(new Set())
    setExcludedMarketValueTiers(new Set())
  }

  // 전체 필터 해제 버튼 옆에 "지금 뭐가 필터링 중인지" 보여주기 위한 라벨 목록.
  const activeFilterLabels: string[] = []
  if (nameFilterStockCodes.size > 0) activeFilterLabels.push('종목명')
  if (excludedMarketValueTiers.size > 0) activeFilterLabels.push('시가총액')
  for (const key of FILTER_KEYS) {
    if (excludedFilters[key].size > 0) {
      const header = COLUMNS.find(col => col.key === key)?.header
      if (header) activeFilterLabels.push(header)
    }
  }

  const filterOptionsByKey = useMemo(() => {
    const result = {} as Record<FilterKey, string[]>
    for (const key of FILTER_KEYS) {
      const values = new Set(items.map(item => displayByStockCode.get(item.stockCode)![key]))
      // market은 가나다순(코스닥이 코스피보다 먼저 옴)이 아니라 코스피 -> 코스닥 고정 순서로 보여준다.
      result[key] =
        key === 'market'
          ? MARKET_FILTER_ORDER.filter(v => values.has(v))
          : [...values].sort((a, b) => KOREAN_COLLATOR.compare(a, b))
    }
    return result
  }, [items, displayByStockCode])

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
  // 전체선택 상태에서 검색 중 처음 체크하는 값은 "이것만 남기기"로 동작한다(엑셀 필터 검색과 동일한 흐름).
  const selectOnlyFilterValue = (key: FilterKey, value: string) => {
    setExcludedFilters(prev => ({ ...prev, [key]: new Set(filterOptionsByKey[key].filter(v => v !== value)) }))
  }

  const filtered = useMemo(
    () =>
      items.filter(item => {
        const display = displayByStockCode.get(item.stockCode)!
        return (
          FILTER_KEYS.every(key => !excludedFilters[key].has(display[key])) &&
          (nameFilterStockCodes.size === 0 || nameFilterStockCodes.has(item.stockCode)) &&
          (item.marketValueTier == null || !excludedMarketValueTiers.has(item.marketValueTier))
        )
      }),
    [items, displayByStockCode, excludedFilters, nameFilterStockCodes, excludedMarketValueTiers],
  )

  // 필터에 걸려서 화면에서 사라진 종목은 선택도 같이 해제한다 — 안 보이는 종목이 일괄변경에
  // 딸려 들어가는 걸 막기 위함. filtered가 실제로 바뀔 때(=필터 조작 시)만 실행되므로 체크박스/hover
  // 같은 잦은 조작과는 무관하다.
  useEffect(() => {
    const visibleStockCodes = new Set(filtered.map(item => item.stockCode))
    setSelectedStockCodes(prev => {
      let changed = false
      const next = new Set<string>()
      for (const stockCode of prev) {
        if (visibleStockCodes.has(stockCode)) {
          next.add(stockCode)
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [filtered])

  const sortedAscending = useMemo(
    () => [...filtered].sort((a, b) => compareByKey(a, b, sortKey, displayByStockCode)),
    [filtered, sortKey, displayByStockCode],
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

  // 행이 수천 개라 전부 DOM에 그려두면(가상화 없이) 체크박스 하나만 바꿔도 브라우저가 그 거대한
  // DOM 전체를 놓고 스타일/레이아웃을 다시 계산한다 — React.memo로는 못 줄이는 비용이라 가상화가 필요하다.
  // 실제 <table>/<tr> 구조는 유지한 채(NES.css 스타일이 table 요소를 대상으로 하므로), 보이는 행 앞뒤로
  // 스페이서 <tr>만 넣어서 스크롤 높이를 흉내내는 방식.
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 26,
    overscan: 15,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom =
    virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex min-h-[38px] shrink-0 items-center justify-between px-2">
        <p className="text-sm font-bold text-white">
          종목수 ({sorted.length}
          {sorted.length !== items.length ? ` / ${items.length}` : ''})
        </p>
        <div className="flex items-center gap-2">
          {hasAnyFilter && (
            <>
              <span className="text-xs text-gray-400">{activeFilterLabels.join('/')} 필터 중</span>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="nes-btn border-sky-500 bg-sky-500 text-xs text-white hover:bg-sky-600"
              >
                전체 필터 해제
              </button>
            </>
          )}
          {selectedStockCodes.size > 0 && (
            <BulkAssignButton count={selectedStockCodes.size} options={categoryOptions} onAssign={handleBulkAssign} />
          )}
        </div>
      </div>
      {/* 스크롤해도 테두리가 사라지지 않도록, 테두리는 스크롤되지 않는 이 바깥 wrapper에 둔다
          (예전엔 <table> 자체에 테두리가 있어서, sticky 헤더가 위로 지나가는 동안 테이블 진짜 위쪽
          테두리가 같이 스크롤돼 사라지고, 맨 아래 테두리도 끝까지 스크롤해야만 보이는 문제가 있었다). */}
      <div className="min-h-0 flex-1 border border-white">
        <div ref={scrollContainerRef} className="h-full overflow-auto scrollbar-thin">
          <table className="nes-table is-dark w-full text-sm [&_td]:border-white/10 [&_td]:py-0.5 [&_th]:border-white/10 [&_th]:py-1">
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                className="cursor-pointer bg-[#4f8fd6] text-center"
                style={{ width: CHECKBOX_COLUMN_WIDTH }}
                onClick={e => {
                  // 체크박스 자신을 클릭한 경우는 onChange가 이미 처리하므로 여기서 중복 토글하지 않는다.
                  if ((e.target as HTMLElement).tagName === 'INPUT') return
                  toggleSelectAllVisible()
                }}
              >
                <input type="checkbox" checked={isAllVisibleSelected} onChange={toggleSelectAllVisible} />
              </th>
              <th className="bg-[#4f8fd6] text-center" style={{ width: NUMBER_COLUMN_WIDTH }}>
                #
              </th>
              {COLUMNS.map(col => {
                const label = (
                  <span className="cursor-pointer select-none hover:text-yellow-400" onClick={() => handleSort(col.key)}>
                    {col.header}
                    <span className={`ml-1 ${sortKey === col.key ? 'text-[#ffee00]' : 'text-gray-400'}`}>
                      {sortKey === col.key ? (sortDirection === 'asc' ? '▲' : '▼') : '▼'}
                    </span>
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
                          onSelectOnly={value => selectOnlyFilterValue(filterKey, value)}
                        />
                      </div>
                    ) : col.key === 'stockName' ? (
                      <div className="flex items-center justify-between pl-2 pr-1">
                        {label}
                        <AdminStockNameFilterButton
                          items={items}
                          selected={nameFilterStockCodes}
                          onToggle={toggleNameFilterStockCode}
                          onClear={() => setNameFilterStockCodes(new Set())}
                        />
                      </div>
                    ) : col.key === 'totalMarketValue' ? (
                      <div className="flex items-center justify-between pl-2 pr-1">
                        <span
                          onMouseEnter={e => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setSnapshotTooltipPos({ left: rect.left + rect.width / 2, top: rect.top })
                          }}
                          onMouseLeave={() => setSnapshotTooltipPos(null)}
                        >
                          {label}
                        </span>
                        {snapshotTime &&
                          snapshotTooltipPos &&
                          createPortal(
                            <div
                              className="nes-container is-dark fixed z-50 w-max -translate-x-1/2 -translate-y-full !bg-violet-950 px-2 py-1 text-[18px] normal-case text-white"
                              style={{ left: snapshotTooltipPos.left, top: snapshotTooltipPos.top - 4 }}
                            >
                              기준: {toFullDateTimeLabel(snapshotTime)}
                            </div>,
                            document.body,
                          )}
                        <AdminMarketValueFilterButton
                          excluded={excludedMarketValueTiers}
                          onToggle={toggleMarketValueTier}
                          onSelectAll={() => setExcludedMarketValueTiers(new Set())}
                          onSelectNone={() => setExcludedMarketValueTiers(new Set(MARKET_VALUE_TIER_OPTIONS.map(o => o.value)))}
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
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length + 2} style={{ height: paddingTop, padding: 0, border: 'none' }} />
                  </tr>
                )}
                {virtualRows.map(virtualRow => {
                  const item = sorted[virtualRow.index]
                  return (
                    <AdminStockRow
                      key={item.stockCode}
                      item={item}
                      index={virtualRow.index}
                      isSelected={selectedStockCodes.has(item.stockCode)}
                      onToggleSelected={toggleSelected}
                      hoveredKind={hoveredRow?.stockCode === item.stockCode ? hoveredRow.kind : null}
                      onParentCategoryHoverStart={handleParentCategoryHoverStart}
                      onMidCategoryHoverStart={handleMidCategoryHoverStart}
                      onSubCategoryHoverStart={handleSubCategoryHoverStart}
                      onAliasHoverStart={handleAliasHoverStart}
                      onHoverEnd={handleHoverEnd}
                      categoryOptions={categoryOptions}
                      categoryOptionsById={categoryOptionsById}
                      onAssign={handleAssign}
                      onUpdateAlias={handleUpdateAlias}
                    />
                  )
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length + 2} style={{ height: paddingBottom, padding: 0, border: 'none' }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
