import { useReportCountLabel } from '@/hooks/useReportCountLabel'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { SectorItem, StockSectorListItem } from '@/types/api'
import { toCount, toFullDateTimeLabel, toJoEokDecimal } from '@/utils/format'
import { appAlert } from '@/utils/appDialogBus'
import { exportRowsToExcel } from '@/utils/exportExcel'
import { useAssignStockSector, useBulkAssignStockSector, useUpdateStockAlias } from '@/hooks/useMarketMapCustom'
import { usePersistedState } from '@/hooks/usePersistedState'
import { useSession } from '@/hooks/useSession'
import Spinner from './Spinner'
import { SearchBar } from './ReadOnlyHeatmapSheet'
import EmptyMessage, { EMPTY_DATA_MESSAGE, EMPTY_SEARCH_MESSAGE } from './EmptyMessage'
import { STOCK_COLUMN_PERCENT, stockColumnPercentWidth } from '@/utils/stockTableColumns'
import { ChevronDownIcon, CloseIcon, ExcelIcon, RedoIcon, SortIcon, UndoIcon } from './icons/MarketMapIcons'

interface Props {
  items: StockSectorListItem[]
  sectors: SectorItem[]
  snapshotTime: string | null
  // 종목수/실행취소·다시실행/필터/엑셀 등 툴바를 이 컨테이너로 포털링한다 — 페이지 공통 세 번째 바
  // 안에 그려야 해서, 이 컴포넌트 안에서 직접 렌더링하지 않고 부모(MarketMapAdminPage)가 그 바 안에
  // 마련해준 DOM 노드로 옮겨 그린다. 상태/핸들러는 전부 이 컴포넌트에 그대로 남아있다.
  toolbarContainer: HTMLElement | null
  // 실행취소·다시실행 아이콘을 그릴 설정창 안의 자리 — 없으면 상단 바 도구줄에 같이 그린다.
  historyContainer?: HTMLElement | null
  // 검색창 옆에 두던 "N/N종목" 개수를 받아 갈 곳 — 페이지가 설정창 머리글에 그려 준다.
  onCountLabelChange?: (label: string | undefined) => void
}

type SortKey =
  | 'stockCode'
  | 'market'
  | 'stockName'
  | 'alias'
  | 'totalMarketValue'
  | 'originCategoryName'
  | 'parentSectorName'
  | 'midSectorName'
  | 'subSectorName'
type SortDirection = 'asc' | 'desc'

// 체크박스(20px)가 줄 높이(29px)에서 남기는 상하 여백(약 4.5px)과 비슷하게 좌우 여백도 4.5px씩 둔다(20 + 9 = 29px).
const CHECKBOX_COLUMN_WIDTH = '29px'
// nes.css의 셀 좌우 패딩(1rem)이 남지 않도록 인라인으로 0에 가깝게 고정한다.
const CHECKBOX_CELL_STYLE = { width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH, maxWidth: CHECKBOX_COLUMN_WIDTH, paddingLeft: 0, paddingRight: 0 } as const

// 정렬을 끈 상태(null)에서 쓰는 기본 순서 — 시가총액 내림차순.
const DEFAULT_SORT_KEY: SortKey = 'totalMarketValue'

const COLUMNS: { key: SortKey; header: string; width: string; align: 'center' | 'left' | 'right' }[] = [
  { key: 'stockCode', header: '종목코드', width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.stockCode), align: 'center' },
  { key: 'stockName', header: '종목명', width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.stockName), align: 'left' },
  { key: 'alias', header: '약칭', width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.alias), align: 'left' },
  { key: 'totalMarketValue', header: '시가총액', width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.totalMarketValue), align: 'right' },
  { key: 'market', header: '마켓', width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.market), align: 'center' },
  { key: 'originCategoryName', header: '섹터', width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.industry), align: 'left' },
  { key: 'parentSectorName', header: '대분류', width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.parentSector), align: 'right' },
  { key: 'midSectorName', header: '중분류', width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.midSector), align: 'right' },
  { key: 'subSectorName', header: '소분류', width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.subSector), align: 'right' },
]

const alignClass = (align: 'center' | 'left' | 'right') =>
  align === 'right' ? 'text-right pr-4' : align === 'left' ? 'text-left pl-4' : 'text-center'

const MARKET_LABEL: Record<'KOSPI' | 'KOSDAQ', string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
const marketColorClass = (market: 'KOSPI' | 'KOSDAQ') => (market === 'KOSPI' ? 'text-gray-400' : 'text-[var(--brand)]')

const KOREAN_COLLATOR = new Intl.Collator('ko')

// 화면에 실제로 표시되는 값 기준으로 정렬하는 열 — 정렬 판정을 이 값으로 통일해서 화면과 어긋나지 않게 한다.
type DisplaySortKey = 'market' | 'originCategoryName' | 'parentSectorName' | 'midSectorName' | 'subSectorName'
const DISPLAY_SORT_KEYS: readonly DisplaySortKey[] = [
  'market',
  'originCategoryName',
  'parentSectorName',
  'midSectorName',
  'subSectorName',
]

function isDisplaySortKey(key: SortKey): key is DisplaySortKey {
  return (DISPLAY_SORT_KEYS as readonly string[]).includes(key)
}

function compareByKey(
  a: StockSectorListItem,
  b: StockSectorListItem,
  key: SortKey,
  displayByStockCode: Map<string, ItemDisplayValues>,
): number {
  if (key === 'totalMarketValue') {
    return (a.totalMarketValue ?? -Infinity) - (b.totalMarketValue ?? -Infinity)
  }
  if (isDisplaySortKey(key)) {
    const av = displayByStockCode.get(a.stockCode)?.[key] ?? ''
    const bv = displayByStockCode.get(b.stockCode)?.[key] ?? ''
    return KOREAN_COLLATOR.compare(av, bv)
  }
  return KOREAN_COLLATOR.compare(a[key] ?? '', b[key] ?? '')
}

// 섹터를 부모-자식 순서로 펼쳐서 검색 옵션으로 만든다 (자식은 들여쓰기 표시).
function buildSectorOptions(sectors: SectorItem[]): SectorOption[] {
  const byParent = new Map<number | null, SectorItem[]>()
  for (const c of sectors) {
    const list = byParent.get(c.parentId)
    if (list) list.push(c)
    else byParent.set(c.parentId, [c])
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  const options: SectorOption[] = []
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

interface SectorOption {
  id: number
  parentId: number | null
  name: string
  label: string
}

// Ctrl+Z/Y 실행취소·다시실행 대상 — 섹터 변경만 관리한다(필터 걸어놓고 섹터를 바꾸면
// 그 종목이 필터에서 바로 사라지는데, 잘못 눌렀을 때 다시 검색하지 않고 바로 되돌리기 위함).
// 메모리에만(컴포넌트 상태) 두고, 종목 탭을 벗어나면(언마운트) 자연히 사라진다.
type UndoableActionInput =
  | { type: 'sector'; stockCode: string; before: number; after: number }
  | { type: 'bulkSector'; sectorName: string; after: number; entries: { stockCode: string; before: number }[] }
// id는 실행취소/다시실행 "목록"에서 스택 순서와 무관하게 특정 항목 하나를 골라 가리키기 위한
// 프론트 전용 식별자 — 백엔드 요청엔 실리지 않는다.
type UndoableAction = UndoableActionInput & { id: string }
const UNDO_STACK_LIMIT = 50

// 실행취소/다시실행 목록에 보여줄 한 줄 설명 — "종목명: 이전 섹터 → 이후 섹터" 형태로,
// 지금 undo 목록에 있든 redo 목록에 있든(즉 아직 실행 전이든 이미 되돌린 뒤든) 항상 같은 문구를 쓴다.
function describeUndoableAction(
  action: UndoableAction,
  items: StockSectorListItem[],
  sectorOptionsById: Map<number, SectorOption>,
): string {
  const sectorLabel = (id: number) => sectorOptionsById.get(id)?.name ?? '(알 수 없음)'
  if (action.type === 'sector') {
    const stockName = items.find(item => item.stockCode === action.stockCode)?.stockName ?? action.stockCode
    return `${stockName}: ${sectorLabel(action.before)} → ${sectorLabel(action.after)} 변경`
  }
  return `${action.entries.length}개 종목 → ${action.sectorName} 변경`
}

// 종목 응답엔 sectorId(실제 배정된 섹터, 뎁스 무관)만 있어서, 대분류/중분류/소분류 3칸에 어떻게
// 나눠 보여줄지는 이미 받아온 섹터 트리를 parentId로 거슬러 올라가며 프론트에서 직접 계산한다.
// 백엔드가 뎁스별 이름 필드를 따로 내려줄 필요가 없어서, 나중에 뎁스가 더 늘어나도 여기만 고치면 된다.
interface SectorChain {
  rootId: number | null
  rootName: string
  midId: number | null
  midName: string | null
  leafId: number | null
  leafName: string | null
}

function resolveSectorChain(sectorOptionsById: Map<number, SectorOption>, sectorId: number): SectorChain {
  const chain: SectorOption[] = []
  let current = sectorOptionsById.get(sectorId)
  while (current) {
    chain.unshift(current)
    current = current.parentId != null ? sectorOptionsById.get(current.parentId) : undefined
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
  parentSectorName: string
  midSectorName: string
  subSectorName: string
}

function computeDisplayValues(item: StockSectorListItem, sectorOptionsById: Map<number, SectorOption>): ItemDisplayValues {
  const chain = resolveSectorChain(sectorOptionsById, item.sectorId)
  return {
    market: MARKET_LABEL[item.market],
    originCategoryName: item.industryName ?? '-',
    parentSectorName: chain.rootName,
    midSectorName: chain.midName ?? '-',
    subSectorName: chain.leafName ?? '-',
  }
}

// 검색어가 자기 이름이나 조상(부모/조부모...) 중 하나에라도 걸리면 매칭으로 본다.
// 예: "반"으로 검색하면 "반도체"뿐 아니라 그 하위 "메모리"/"파운드리"도 같이 남는다.
function matchesSectorSearch(option: SectorOption, trimmed: string, byId: Map<number, SectorOption>): boolean {
  let current: SectorOption | undefined = option
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

// 필터 팝업 목록 한 행의 높이(px) — 테이블 본문과 같은 text-sm(20px 줄높이) + py-0.5(위아래 2px씩) 기준.
const FILTER_LIST_ROW_HEIGHT = 24
// 필터 팝업을 한 화면에 몇 개 행까지 보여줄지 — 이보다 적으면 목록 실제 높이만큼만 차지하고,
// 많으면 이 높이에서 스크롤(overflow-y-auto)된다.
const FILTER_LIST_MAX_VISIBLE_ROWS = 15
const FILTER_LIST_MAX_HEIGHT = FILTER_LIST_ROW_HEIGHT * FILTER_LIST_MAX_VISIBLE_ROWS

// 팝업(섹터 검색창/필터 드롭다운) 공통 로직 — 트리거 기준 위치 계산 + 바깥 클릭/스크롤 시 닫기.
function usePopupPosition(
  isOpen: boolean,
  setIsOpen: (open: boolean) => void,
  triggerRef: React.RefObject<HTMLElement | null>,
  popupRef: React.RefObject<HTMLElement | null>,
  onOpen?: () => void,
  // 팝업이 아래로 열렸을 때 화면 밖으로 잘리지 않게, 트리거가 화면 세로 기준 몇 % 아래부터 위로 뒤집을지.
  // 팝업이 클수록(예: 섹터 검색 목록) 더 일찍(작은 값) 뒤집어야 한다.
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

// 실행취소/다시실행 히스토리 목록 팝업 — 최신 항목이 위로 오도록 뒤집어서 보여주고, 텍스트는 항상
// 고정("종목명: 이전 → 이후")이며 각 행에 마우스를 올렸을 때만 우측에 실행취소/다시실행 텍스트 버튼이
// 나타난다. 클릭하면 스택 순서와 무관하게 그 항목 하나만 되돌리거나 다시 적용한다.
function UndoRedoHistoryPopup({
  isOpen,
  setIsOpen,
  triggerRef,
  actions,
  direction,
  items,
  sectorOptionsById,
  onPick,
}: {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  actions: UndoableAction[]
  direction: 'undo' | 'redo'
  items: StockSectorListItem[]
  sectorOptionsById: Map<number, SectorOption>
  onPick: (id: string) => void
}) {
  const popupRef = useRef<HTMLDivElement>(null)
  // 툴바 왼쪽(종목수 옆)에 있는 버튼이라 오른쪽에 펼칠 공간이 넉넉함 — alignRight 없이 왼쪽 정렬로 연다.
  const position = usePopupPosition(isOpen, setIsOpen, triggerRef, popupRef, undefined, 0.8, false)
  const actionLabel = direction === 'undo' ? '실행취소' : '다시실행'

  if (!isOpen || !position) return null

  const ordered = [...actions].reverse()

  return (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: `translate(${position.alignRight ? '-100%' : '0'}, ${position.openUpward ? '-100%' : '0'})`,
      }}
      className="nes-container is-dark z-50 !bg-violet-950 p-2 text-sm"
      onClick={e => e.stopPropagation()}
    >
      {ordered.length === 0 ? (
        <p className="whitespace-nowrap px-1 text-gray-400">{actionLabel}할 변경 내역이 없습니다</p>
      ) : (
        <div className="overflow-y-auto scrollbar-thin" style={{ maxHeight: FILTER_LIST_MAX_HEIGHT }}>
          {ordered.map(action => (
            <div
              key={action.id}
              className="group flex items-center justify-between gap-3 whitespace-nowrap rounded px-1 py-0.5 hover:bg-[var(--brand)]/10"
            >
              <span className="text-white">{describeUndoableAction(action, items, sectorOptionsById)}</span>
              <button
                type="button"
                onClick={() => {
                  onPick(action.id)
                  setIsOpen(false)
                }}
                  className="hidden shrink-0 border-0 bg-transparent text-xs text-white hover:text-[var(--brand)] group-hover:inline-block"
              >
                {actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 섹터 검색창의 검색어/방향키 탐색 상태 — AdminStockSectorCell과 BulkAssignButton이 공유.
// isOpen이 false(팝업 닫힘)면 아무도 matches를 안 쓰므로 계산 자체를 건너뛴다 — 행이 수천 개라
// 팝업 열림 여부와 무관하게 매 렌더마다 계산하면 그 비용이 그대로 누적된다.
function useSectorSearchState(options: SectorOption[], isOpen: boolean) {
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
  // 검색 전엔 전체 섹터를 그대로 보여주고(방향키로 바로 탐색 가능), 검색어가 있으면 그 안에서만 필터링한다.
  // 부모가 매칭되면 그 하위 섹터도 같이 남겨서(예: "반" -> 반도체 + 메모리/파운드리), 트리 맥락이 끊기지 않게 한다.
  const matches = useMemo(() => {
    if (!isOpen || !trimmed) return options
    const optionsById = new Map(options.map(opt => [opt.id, opt]))
    return options.filter(opt => matchesSectorSearch(opt, trimmed, optionsById))
  }, [isOpen, trimmed, options])

  const handleArrowsAndEnter = (e: React.KeyboardEvent<HTMLInputElement>, onSelect: (sectorId: number) => void) => {
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

// 섹터 검색 팝업(검색창 + 전체/필터링된 목록). 대분류·소분류 셀과 일괄변경 버튼이 트리거만 다르게 해서 같이 쓴다.
function SectorSearchPopup({
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
  search: ReturnType<typeof useSectorSearchState>
  onSelect: (sectorId: number) => void
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
        placeholder="업종 검색"
        className="nes-input is-dark w-full py-2 text-sm"
      />
      {contextLabel && (
        <span className="mt-2 inline-block rounded bg-[var(--brand)]/25 px-2 py-0.5 text-xs text-white">
          {contextLabel}
        </span>
      )}
      <div className="mt-2 border-t border-gray-600 pt-2">
        <div className="overflow-y-auto scrollbar-thin" style={{ maxHeight: FILTER_LIST_MAX_HEIGHT }}>
          {search.matches.length === 0 ? (
            <p className="px-2 py-1 text-sm text-gray-400">검색 결과가 없습니다</p>
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
                className={`block w-full truncate rounded px-2 py-0.5 text-left text-sm text-white ${
                  index === search.highlightedIndex ? 'bg-[var(--brand)]/25' : 'bg-transparent'
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
function AdminStockSectorCell({
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
  options: SectorOption[]
  onAssign: (sectorId: number) => void
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
  const search = useSectorSearchState(options, isOpen)

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

  // 섹터 목록 팝업은 세로로 훨씬 커져서(약 12개 높이), 기본 임계값(80%)보다 일찍 위로 뒤집어야 화면 밖으로 안 잘린다.
  // 대분류/소분류는 테이블 우측에 몰려있어 오른쪽으로 열면 화면 밖으로 잘리므로, 필터 팝업과 동일하게
  // 셀 우측 끝에 맞춰 왼쪽으로 열리게 한다.
  const position = usePopupPosition(isOpen, updateOpen, cellRef, popupRef, () => inputRef.current?.focus(), 0.6, true)

  const handleSelect = (sectorId: number) => {
    onAssign(sectorId)
    updateOpen(false)
  }

  return (
    <td
      ref={cellRef}
      data-no-row-select
      className={`pl-4 text-left ${disabled ? 'cursor-default text-gray-500' : 'cursor-pointer'} ${
        isHighlighted ? 'bg-[var(--brand)]/35' : rowHoverClass
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
        <SectorSearchPopup
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
          className="nes-container is-dark z-50 whitespace-nowrap !bg-violet-950 px-3 py-2 text-sm text-white"
        >
          {disabledHint}
        </div>
      )}
    </td>
  )
}

// 체크된 종목들을 한 섹터로 한 번에 재배정하는 버튼. 팝업 자체는 AdminStockSectorCell과 동일하게 동작한다.
function BulkAssignButton({
  count,
  options,
  onAssign,
  alignRight = false,
  widthPx,
  disabled = false,
  disabledHint,
}: {
  count: number
  options: SectorOption[]
  onAssign: (sectorId: number) => void
  alignRight?: boolean
  // 아래 실제 컬럼(th) 폭에 맞추기 위한 값 — 없으면 버튼 기본(내용에 맞는) 폭을 그대로 쓴다.
  widthPx?: number
  // 선행 단계(1차/2차)가 아직 적용 안 된 상태의 2차/3차 버튼 — 버튼 자체는 평소와 똑같이 보이되,
  // 클릭하면 팝업 대신 안내 문구만 잠깐 띄운다(AdminStockSectorCell의 disabled 셀과 동일한 패턴).
  disabled?: boolean
  disabledHint?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const search = useSectorSearchState(options, isOpen)

  const position = usePopupPosition(
    isOpen,
    setIsOpen,
    buttonRef,
    popupRef,
    () => inputRef.current?.focus(),
    0.6,
    alignRight,
  )

  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current)
    }
  }, [])

  const handleClick = () => {
    if (disabled) {
      if (!disabledHint) return
      setShowHint(true)
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current)
      hintTimeoutRef.current = setTimeout(() => setShowHint(false), 1000)
      return
    }
    search.reset()
    setIsOpen(true)
  }

  const handleSelect = (sectorId: number) => {
    onAssign(sectorId)
    setIsOpen(false)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        style={widthPx != null ? { width: widthPx } : undefined}
        className="flex h-6 items-center justify-center rounded border-0 bg-transparent px-1.5 text-sm text-[var(--brand)] transition-colors hover:bg-white/10"
      >
        일괄변경 ({count})
      </button>
      {isOpen && position && !disabled && (
        <SectorSearchPopup
          popupRef={popupRef}
          inputRef={inputRef}
          position={position}
          search={search}
          onSelect={handleSelect}
          onEscape={() => setIsOpen(false)}
        />
      )}
      {disabled && showHint && disabledHint && (
        <div
          style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)' }}
          className="nes-container is-dark z-50 whitespace-nowrap !bg-violet-950 px-3 py-2 text-sm text-white"
        >
          {disabledHint}
        </div>
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
      // 입력칸은 칸 안쪽(좌우 8px 여백)에 두고 입력 글자 시작선을 보통 글자(pl-4=16px)와 맞춘다.
      <td className={`text-left px-2 ${rowHoverClass}`} data-no-row-select onClick={e => e.stopPropagation()}>
        <input
          type="text"
          autoFocus
          aria-label="운영자 전용 약칭"
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={stopEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') stopEdit()
          }}
          className="nes-input is-dark h-5 w-full rounded-md border-0 bg-[#3b3b3b] px-2 text-left text-sm text-white outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--brand)]"
        />
      </td>
    )
  }

  return (
    <td
      className={`cursor-pointer text-white ${alignClass('left')} ${isHighlighted ? 'bg-[var(--brand)]/35' : rowHoverClass}`}
      data-no-row-select
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

// 종목 한 행. React.memo로 감싸서, 다른 행의 체크박스/hover로 부모가 리렌더돼도
// props가 안 바뀐 행은 리렌더를 건너뛴다 (행이 2700여 개라 이게 없으면 체크박스 하나 눌러도 전체가 다시 그려진다).
const AdminStockRow = memo(function AdminStockRow({
  item,
  index,
  isSelected,
  onToggleSelected,
  onRowMouseDown,
  hoveredKind,
  onParentSectorHoverStart,
  onMidSectorHoverStart,
  onSubSectorHoverStart,
  onAliasHoverStart,
  onHoverEnd,
  sectorOptions,
  sectorOptionsById,
  onAssign,
  onUpdateAlias,
  showAlias,
}: {
  item: StockSectorListItem
  index: number
  isSelected: boolean
  onToggleSelected: (stockCode: string, shiftKey: boolean) => void
  onRowMouseDown: (stockCode: string, index: number, x: number, y: number) => void
  hoveredKind: 'parentSector' | 'midSector' | 'subSector' | 'alias' | null
  onParentSectorHoverStart: (stockCode: string) => void
  onMidSectorHoverStart: (stockCode: string) => void
  onSubSectorHoverStart: (stockCode: string) => void
  onAliasHoverStart: (stockCode: string) => void
  onHoverEnd: () => void
  sectorOptions: SectorOption[]
  sectorOptionsById: Map<number, SectorOption>
  onAssign: (stockCode: string, sectorId: number) => void
  onUpdateAlias: (stockCode: string, alias: string | null) => void
  showAlias: boolean
}) {
  // 행 어디에 마우스를 올려도(체크박스/#/시가총액 등 포함) 줄 전체가 옅게 강조되고, 대분류/소분류/약칭
  // 중 하나를 hover 중일 때는 그 열만 추가로 진하게 표시해서 어떤 걸 hover 중인지 구분되게 한다.
  // 체크박스로 선택된 행도 hover 중이 아니어도 항상 동일한 옅은 강조를 유지한다.
  const [isRowHovered, setIsRowHovered] = useState(false)
  // 약칭 수정 중이거나 대분류/소분류 검색 팝업이 열려있는 동안은, 마우스가 그 행 위에 없어도
  // (예: 입력하다가 다른 곳으로 시선이 옮겨간 경우) 지금 어느 행을 수정 중인지 계속 보이도록 강조를 유지한다.
  const [editingCells, setEditingCells] = useState<Set<'alias' | 'sector1' | 'sector2' | 'sector3'>>(new Set())
  const setCellEditing = (key: 'alias' | 'sector1' | 'sector2' | 'sector3', editing: boolean) => {
    setEditingCells(prev => {
      const next = new Set(prev)
      if (editing) next.add(key)
      else next.delete(key)
      return next
    })
  }
  // 선택된 줄은 호버(옅은 색)와 확실히 구분되게 진한 브랜드색으로, 선택 + 호버면 한 단계 더 진하게 칠한다.
  const rowHoverClass = isSelected
    ? isRowHovered
      ? 'bg-[var(--brand)]/50'
      : 'bg-[var(--brand)]/35'
    : isRowHovered || editingCells.size > 0
      ? 'bg-[var(--brand)]/10'
      : ''

  // 대분류 팝업엔 최상위 섹터만, 중분류 팝업엔 "지금 이 종목의 대분류"의 자식만, 소분류 팝업엔
  // "지금 이 종목의 중분류"의 자식만 보여준다. sectorId(실제 배정된 섹터)를 parentId로 거슬러
  // 올라가서 전체 조상 체인을 구한 뒤, 뎁스별로 슬롯에 나눠 담는다.
  const chain = resolveSectorChain(sectorOptionsById, item.sectorId)
  const parentSectorOptions = sectorOptions.filter(opt => opt.parentId === null)
  // 이미 한 단계 위로 좁혀진 목록이라 "- " 들여쓰기 접두어가 필요 없다 — 그냥 이름 그대로 보여준다.
  const midSectorOptions = sectorOptions
    .filter(opt => opt.parentId === chain.rootId)
    .map(opt => ({ ...opt, label: opt.name }))
  const subSectorOptions =
    chain.midId != null
      ? sectorOptions.filter(opt => opt.parentId === chain.midId).map(opt => ({ ...opt, label: opt.name }))
      : []

  // 체크박스를 정확히 조준하지 않아도, hover 강조가 뜨는 영역(약칭/대분류/소분류 제외 전체) 아무 곳이나
  // 클릭하면 체크가 토글되게 한다. 약칭/대분류/소분류 셀은 자기 클릭(stopPropagation)으로 배제된다.
  // 체크박스 자신의 클릭도 이 줄 클릭으로 올라와 한 번만 처리된다(Shift 키 여부를 여기서 알 수 있어서).
  // Shift를 누르고 누르면 직전에 누른 줄부터 이 줄까지 범위를 한 번에 선택한다(부모의 toggleSelected 참고).
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    onToggleSelected(item.stockCode, e.shiftKey)
  }
  // Shift+클릭이 브라우저의 글자 범위 선택(파란 드래그 표시)을 일으키지 않게 한다. 그냥 누른 경우에는 드래그 선택을
  // 시작할 수 있게 부모에 알린다(편집하는 칸은 data-no-row-select로 제외).
  const handleRowMouseDown = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if (e.shiftKey) {
      e.preventDefault()
      return
    }
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-no-row-select]')) return
    onRowMouseDown(item.stockCode, index, e.clientX, e.clientY)
  }

  return (
    <tr
      data-row-index={index}
      onClick={handleRowClick}
      onMouseDown={handleRowMouseDown}
      onMouseEnter={() => setIsRowHovered(true)}
      onMouseLeave={() => setIsRowHovered(false)}
    >
      <td className={`text-center ${rowHoverClass}`} style={CHECKBOX_CELL_STYLE}>
        {/* 상태 변경은 줄 클릭(handleRowClick)에서 하므로 onChange는 비워 둔다 — 제어되는 체크박스에 필요한 자리표시다. */}
        <input type="checkbox" className="mx-auto my-0 block h-5 w-5 cursor-pointer accent-[var(--brand)]" checked={isSelected} onChange={() => {}} />
      </td>
      <td className={`${alignClass('center')} text-gray-400 ${rowHoverClass}`}>{item.stockCode}</td>
      <td className={`${alignClass('left')} ${marketColorClass(item.market)} ${rowHoverClass}`}>{item.stockName}</td>
      {showAlias && (
        <AdminAliasCell
          alias={item.alias}
          onUpdate={alias => onUpdateAlias(item.stockCode, alias)}
          isHighlighted={hoveredKind === 'alias'}
          rowHoverClass={rowHoverClass}
          onHoverStart={() => onAliasHoverStart(item.stockCode)}
          onHoverEnd={onHoverEnd}
          onEditingChange={editing => setCellEditing('alias', editing)}
        />
      )}
      <td className={`${alignClass('right')} text-gray-400 ${rowHoverClass}`}>
        {item.totalMarketValue != null ? toJoEokDecimal(item.totalMarketValue / 100_000_000) : '-'}
      </td>
      <td className={`text-center ${marketColorClass(item.market)} ${rowHoverClass}`}>{MARKET_LABEL[item.market]}</td>
      <td className={`${alignClass('left')} text-gray-400 ${rowHoverClass}`}>{item.industryName ?? '-'}</td>
      <AdminStockSectorCell
        value={chain.rootName}
        options={parentSectorOptions}
        onAssign={sectorId => onAssign(item.stockCode, sectorId)}
        isHighlighted={hoveredKind === 'parentSector'}
        rowHoverClass={rowHoverClass}
        onHoverStart={() => onParentSectorHoverStart(item.stockCode)}
        onHoverEnd={onHoverEnd}
        onEditingChange={editing => setCellEditing('sector1', editing)}
      />
      <AdminStockSectorCell
        value={chain.midName ?? '-'}
        options={midSectorOptions}
        onAssign={sectorId => onAssign(item.stockCode, sectorId)}
        isHighlighted={hoveredKind === 'midSector'}
        rowHoverClass={rowHoverClass}
        onHoverStart={() => onMidSectorHoverStart(item.stockCode)}
        onHoverEnd={onHoverEnd}
        onEditingChange={editing => setCellEditing('sector2', editing)}
        contextLabel={chain.rootName}
      />
      <AdminStockSectorCell
        value={chain.leafName ?? '-'}
        options={subSectorOptions}
        onAssign={sectorId => onAssign(item.stockCode, sectorId)}
        isHighlighted={hoveredKind === 'subSector'}
        rowHoverClass={rowHoverClass}
        onHoverStart={() => onSubSectorHoverStart(item.stockCode)}
        onHoverEnd={onHoverEnd}
        onEditingChange={editing => setCellEditing('sector3', editing)}
        contextLabel={chain.midName ?? undefined}
        disabled={chain.midId == null}
        disabledHint="중분류를 먼저 지정하세요"
      />
    </tr>
  )
})

export default function AdminStockTable({
  items,
  sectors,
  snapshotTime,
  toolbarContainer,
  historyContainer,
  onCountLabelChange,
}: Props) {
  const [sortKey, setSortKey] = usePersistedState<SortKey | null>('adminStockTable.sortKey', DEFAULT_SORT_KEY)
  const [sortDirection, setSortDirection] = usePersistedState<SortDirection>('adminStockTable.sortDirection', 'desc')
  const [isPending, startTransition] = useTransition()
  // 헤더가 sticky + 스크롤 컨테이너(overflow-auto) 안에 있어서, 그 위로 뜨는 툴팁은 일반 absolute로는
  // 부모의 overflow에 잘린다 — body에 포털로 그려서 잘리지 않게 한다(MarketMapBox 등과 동일한 패턴).
  const [snapshotTooltipPos, setSnapshotTooltipPos] = useState<{ left: number; top: number } | null>(null)

  const assignStockSector = useAssignStockSector()
  const bulkAssignStockSector = useBulkAssignStockSector()
  const updateAlias = useUpdateStockAlias()
  // 약칭 지정은 관리자 전용이다 — 관리자의 약칭은 MARKETRY로 올릴 내용에만 쓰이고, 다른 사용자의 데이터는 건드리지 않는다.
  // 일반 사용자에게는 약칭 열 자체를 보여주지 않고(백엔드도 관리자만 허용한다), 그 너비는 종목명 열이 받는다.
  const isAdmin = useSession().data?.role === 'ADMIN'
  const columns = useMemo(
    () =>
      isAdmin
        ? COLUMNS
        : COLUMNS.filter(col => col.key !== 'alias').map(col =>
            col.key === 'stockName'
              ? { ...col, width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.stockName + STOCK_COLUMN_PERCENT.alias) }
              : col,
          ),
    [isAdmin],
  )
  // handleAssign/runBulkAssign에서 "변경 전" 섹터를 읽어야 하는데, items를 그대로 의존성에 넣으면
  // 섹터가 바뀔 때마다(=매 변경마다) 콜백 identity가 바뀌어 AdminStockRow의 memo가 무력화된다 —
  // ref로 최신 값만 따라가게 해서 콜백은 그대로 안정적으로 유지한다.
  const itemsRef = useRef(items)
  itemsRef.current = items

  // Ctrl+Z/Y 실행취소·다시실행 스택(섹터 변경만 대상, 메모리에만 유지).
  const [undoStack, setUndoStack] = useState<UndoableAction[]>([])
  const [redoStack, setRedoStack] = useState<UndoableAction[]>([])
  const actionIdRef = useRef(0)
  const pushUndo = useCallback((action: UndoableActionInput) => {
    const withId: UndoableAction = { ...action, id: String(actionIdRef.current++) }
    setUndoStack(prev => [...prev.slice(-UNDO_STACK_LIMIT + 1), withId])
    setRedoStack([])
  }, [])
  const applySectorAction = (action: UndoableAction, direction: 'before' | 'after') => {
    if (action.type === 'sector') {
      assignStockSector.mutate({ stockCode: action.stockCode, sectorId: direction === 'before' ? action.before : action.after })
    } else {
      for (const entry of action.entries) {
        assignStockSector.mutate({ stockCode: entry.stockCode, sectorId: direction === 'before' ? entry.before : action.after })
      }
    }
  }
  const handleUndo = () => {
    const action = undoStack[undoStack.length - 1]
    if (!action) return
    applySectorAction(action, 'before')
    setUndoStack(prev => prev.slice(0, -1))
    setRedoStack(prev => [...prev, action])
  }
  const handleRedo = () => {
    const action = redoStack[redoStack.length - 1]
    if (!action) return
    applySectorAction(action, 'after')
    setRedoStack(prev => prev.slice(0, -1))
    setUndoStack(prev => [...prev, action])
  }
  // 목록에서 스택 위치와 무관하게 특정 항목 하나만 골라 되돌리거나 다시 적용 — 순서 상관없이
  // 그 항목의 before/after 값으로 직접 바꿔버리고, 다른 항목들의 순서는 그대로 둔다.
  const handleUndoItem = (id: string) => {
    const action = undoStack.find(a => a.id === id)
    if (!action) return
    applySectorAction(action, 'before')
    setUndoStack(prev => prev.filter(a => a.id !== id))
    setRedoStack(prev => [...prev, action])
  }
  const handleRedoItem = (id: string) => {
    const action = redoStack.find(a => a.id === id)
    if (!action) return
    applySectorAction(action, 'after')
    setRedoStack(prev => prev.filter(a => a.id !== id))
    setUndoStack(prev => [...prev, action])
  }
  const [isUndoListOpen, setIsUndoListOpen] = useState(false)
  const [isRedoListOpen, setIsRedoListOpen] = useState(false)
  // 목록 팝업 위치 기준은 화살표가 아니라 UNDO/REDO 버튼 전체(테두리) — 팝업 좌측이 버튼 좌측 테두리와 맞도록.
  const undoGroupRef = useRef<HTMLDivElement>(null)
  const redoGroupRef = useRef<HTMLDivElement>(null)
  // 키보드 리스너는 마운트 시 한 번만 등록하고(=종목 탭에 있는 동안만, 언마운트되면 자동 해제),
  // 매번 최신 핸들러를 부르도록 ref로 우회한다.
  const undoRef = useRef(handleUndo)
  undoRef.current = handleUndo
  const redoRef = useRef(handleRedo)
  redoRef.current = handleRedo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      // 입력창 안에서는 브라우저 기본 실행취소(텍스트 되돌리기)에 맡긴다.
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redoRef.current()
        else undoRef.current()
      } else if (key === 'y') {
        e.preventDefault()
        redoRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  // sectors가 안 바뀌면 참조를 유지해야 AdminStockRow의 React.memo가 제대로 스킵된다.
  const sectorOptions = useMemo(() => buildSectorOptions(sectors), [sectors])
  const sectorOptionsById = useMemo(() => new Map(sectorOptions.map(opt => [opt.id, opt])), [sectorOptions])
  // 필터/정렬/컬럼 표시에 쓰는 대분류·중분류·소분류 문자열을 종목마다 한 번씩만 미리 계산해둔다.
  const displayByStockCode = useMemo(
    () => new Map(items.map(item => [item.stockCode, computeDisplayValues(item, sectorOptionsById)])),
    [items, sectorOptionsById],
  )
  // 대분류/중분류/소분류는 이제 각각 별도로 assign 요청을 보내는 독립된 액션이라, 셀마다 따로 강조한다.
  const [hoveredRow, setHoveredRow] = useState<{
    stockCode: string
    kind: 'parentSector' | 'midSector' | 'subSector' | 'alias'
  } | null>(null)
  // 필터/정렬이 바뀌어도 선택 상태는 stockCode 기준으로 유지된다 (전체선택만 "지금 보이는 것" 기준으로 동작).
  const [selectedStockCodes, setSelectedStockCodes] = useState<Set<string>>(new Set())
  // 1차→2차→3차 순서로 일괄적용하는 단계형 플로우 상태 — 이번 선택 안에서 방금 일괄적용한 1차/2차를
  // 기억해뒀다가, 2차/3차 버튼의 선택지를 그 하위 섹터로만 좁힌다. 선택이 전부 풀리면(새 작업 시작) 초기화.
  const [bulkParentId, setBulkParentId] = useState<number | null>(null)
  const [bulkMidId, setBulkMidId] = useState<number | null>(null)
  useEffect(() => {
    if (selectedStockCodes.size === 0) {
      setBulkParentId(null)
      setBulkMidId(null)
    }
  }, [selectedStockCodes])

  // 툴바의 1차/2차/3차 일괄적용 버튼 폭을 그 컬럼(th) 실제 렌더 폭에 맞추기 위한 측정 — 버튼은 계속
  // 툴바(테이블 밖) 안에 그대로 있고, 폭만 아래 컬럼과 맞춘다. 위치는 안 건드리므로 테이블 레이아웃엔 영향 없음.
  const parentThRef = useRef<HTMLTableCellElement>(null)
  const midThRef = useRef<HTMLTableCellElement>(null)
  const subThRef = useRef<HTMLTableCellElement>(null)
  const [bulkButtonWidths, setBulkButtonWidths] = useState<{ parent: number; mid: number; sub: number } | null>(null)

  useLayoutEffect(() => {
    if (selectedStockCodes.size === 0) return
    const measure = () => {
      const parentWidth = parentThRef.current?.getBoundingClientRect().width
      const midWidth = midThRef.current?.getBoundingClientRect().width
      const subWidth = subThRef.current?.getBoundingClientRect().width
      if (parentWidth == null || midWidth == null || subWidth == null) return
      setBulkButtonWidths({ parent: parentWidth, mid: midWidth, sub: subWidth })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 선택 여부(비어있다가 생기는 전환)에만 반응하면 됨
  }, [selectedStockCodes.size > 0])

  const handleSort = (key: SortKey) => {
    startTransition(() => {
      // 같은 열을 계속 누르면 오름차순 → 내림차순 → 정렬 해제(기본 순서(시가총액 내림차순)) 순으로 돈다.
      if (key === sortKey) {
        if (sortDirection === 'asc') setSortDirection('desc')
        else setSortKey(null)
      } else {
        setSortKey(key)
        setSortDirection('asc')
      }
    })
  }

  // AdminStockRow에 props로 내려가는 콜백들 — 매 렌더마다 새 함수면 React.memo가 무력화되므로 useCallback으로 고정한다.
  const handleAssign = useCallback(
    (stockCode: string, sectorId: number) => {
      const before = itemsRef.current.find(item => item.stockCode === stockCode)?.sectorId
      assignStockSector.mutate({ stockCode, sectorId: sectorId })
      if (before != null && before !== sectorId) {
        pushUndo({ type: 'sector', stockCode, before, after: sectorId })
      }
    },
    [assignStockSector, pushUndo],
  )

  const handleUpdateAlias = useCallback(
    (stockCode: string, alias: string | null) => {
      updateAlias.mutate({ stockCode, alias })
    },
    [updateAlias],
  )

  // Shift+클릭 범위 선택용 — 마지막으로 누른 줄(기준 줄)과, 지금 화면에 보이는 순서의 목록(콜백을 고정하려고 ref로 둔다).
  const lastClickedStockCodeRef = useRef<string | null>(null)
  const visibleItemsRef = useRef<StockSectorListItem[]>([])

  // 여러 줄 선택 안내 — 드래그나 Shift+클릭을 모른 채 줄을 하나씩 계속 누르는 사용자에게 한 번 알려준다. 페이지를 새로 열 때마다
  // 처음부터 다시 센다(저장하지 않는다): 또 하나씩 누르고 있다면 그새 잊은 것이라는 판단이다. 한 번 보여주거나 드래그·Shift를
  // 쓰면 그 페이지에서는 다시 띄우지 않는다.
  const SELECTION_HINT_CLICK_COUNT = 3
  const SELECTION_HINT_DURATION_MS = 6000
  const [isSelectionHintOpen, setIsSelectionHintOpen] = useState(false)
  const plainSelectClickCountRef = useRef(0)
  const selectionHintShownRef = useRef(false)
  const noteMultiSelectUsed = useCallback(() => {
    selectionHintShownRef.current = true
    setIsSelectionHintOpen(false)
  }, [])
  useEffect(() => {
    if (!isSelectionHintOpen) return
    const timer = setTimeout(() => setIsSelectionHintOpen(false), SELECTION_HINT_DURATION_MS)
    return () => clearTimeout(timer)
  }, [isSelectionHintOpen])

  // 드래그 선택 상태 — 누른 줄(기준)과 그 시점의 선택 상태(baseline), 끌어서 적용할 상태(selectTo)를 들고 있다가
  // 마우스가 움직일 때마다 baseline에 [기준 줄 ~ 지금 줄] 범위를 적용한다. baseline에서 매번 다시 계산하므로
  // 마우스를 되돌리면 선택 범위도 줄어든다.
  const dragRef = useRef<{
    anchorIndex: number
    baseline: Set<string>
    selectTo: boolean
    moved: boolean
    lastIndex: number
    pointer: { x: number; y: number }
  } | null>(null)
  // 끌기를 마친 직후 따라오는 click이 한 줄을 다시 토글하지 않게 막는 표시.
  const suppressClickRef = useRef(false)
  const dragFrameRef = useRef<number | null>(null)
  const selectedRef = useRef(selectedStockCodes)
  useEffect(() => {
    selectedRef.current = selectedStockCodes
  }, [selectedStockCodes])

  const handleRowMouseDown = useCallback((stockCode: string, index: number, x: number, y: number) => {
    // Shift+클릭 범위 선택이 이 줄에서 이어지도록 기준 줄도 같이 기억한다.
    lastClickedStockCodeRef.current = stockCode
    dragRef.current = {
      anchorIndex: index,
      baseline: new Set(selectedRef.current),
      selectTo: !selectedRef.current.has(stockCode),
      moved: false,
      lastIndex: index,
      pointer: { x, y },
    }
  }, [])

  // 마우스 아래의 줄을 좌표로 찾아 선택 범위를 갱신한다 — 표가 화면에 보이는 줄만 그려서, 자동 스크롤 중에는
  // mouseenter에 기대지 않고 좌표로 찾는 편이 확실하다. 마우스가 표 밖(위·아래)에 있어도 가장자리 줄로 본다.
  const applyDragAtPointer = useCallback(() => {
    const drag = dragRef.current
    const container = scrollContainerRef.current
    if (!drag || !container) return
    const rect = container.getBoundingClientRect()
    const y = Math.min(Math.max(drag.pointer.y, rect.top + 1), rect.bottom - 1)
    const row = document.elementFromPoint(drag.pointer.x, y)?.closest<HTMLElement>('tr[data-row-index]')
    if (!row) return
    const index = Number(row.dataset.rowIndex)
    if (!drag.moved && index === drag.anchorIndex) return
    if (!drag.moved) {
      drag.moved = true
      document.body.style.userSelect = 'none'
      noteMultiSelectUsed()
    }
    if (index === drag.lastIndex) return
    drag.lastIndex = index
    const visibleItems = visibleItemsRef.current
    const next = new Set(drag.baseline)
    const from = Math.min(drag.anchorIndex, index)
    const to = Math.max(drag.anchorIndex, index)
    for (let i = from; i <= to; i++) {
      const code = visibleItems[i]?.stockCode
      if (code === undefined) continue
      if (drag.selectTo) next.add(code)
      else next.delete(code)
    }
    setSelectedStockCodes(next)
  }, [noteMultiSelectUsed])

  useEffect(() => {
    const EDGE_PX = 40
    const MAX_SCROLL_PX = 24
    // 끌다가 표 위·아래 가장자리에 닿으면 그쪽으로 스크롤한다(가장자리에 가까울수록 빠르게).
    const tick = () => {
      const drag = dragRef.current
      const container = scrollContainerRef.current
      if (!drag || !container) {
        dragFrameRef.current = null
        return
      }
      if (drag.moved) {
        const rect = container.getBoundingClientRect()
        let delta = 0
        if (drag.pointer.y < rect.top + EDGE_PX) {
          delta = -Math.min(MAX_SCROLL_PX, Math.ceil((MAX_SCROLL_PX * (rect.top + EDGE_PX - drag.pointer.y)) / EDGE_PX))
        } else if (drag.pointer.y > rect.bottom - EDGE_PX) {
          delta = Math.min(MAX_SCROLL_PX, Math.ceil((MAX_SCROLL_PX * (drag.pointer.y - (rect.bottom - EDGE_PX))) / EDGE_PX))
        }
        if (delta !== 0) {
          container.scrollTop += delta
          applyDragAtPointer()
        }
      }
      dragFrameRef.current = requestAnimationFrame(tick)
    }
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      drag.pointer = { x: e.clientX, y: e.clientY }
      applyDragAtPointer()
      if (dragFrameRef.current === null) dragFrameRef.current = requestAnimationFrame(tick)
    }
    const stopDrag = () => {
      const drag = dragRef.current
      if (!drag) return
      dragRef.current = null
      document.body.style.userSelect = ''
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = null
      }
      if (drag.moved) {
        // 끌기가 끝난 직후의 click(같은 줄에서 뗀 경우)은 선택을 다시 뒤집지 않도록 한 번만 무시한다.
        suppressClickRef.current = true
        setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopDrag)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopDrag)
      stopDrag()
    }
  }, [applyDragAtPointer])

  const toggleSelected = useCallback((stockCode: string, shiftKey: boolean) => {
    if (suppressClickRef.current) return
    if (shiftKey) {
      noteMultiSelectUsed()
    } else if (!selectedRef.current.has(stockCode)) {
      // 하나씩 눌러서 선택을 늘리는 횟수만 센다(해제는 세지 않는다).
      plainSelectClickCountRef.current += 1
      if (plainSelectClickCountRef.current >= SELECTION_HINT_CLICK_COUNT && !selectionHintShownRef.current) {
        selectionHintShownRef.current = true
        setIsSelectionHintOpen(true)
      }
    }
    const anchorStockCode = lastClickedStockCodeRef.current
    lastClickedStockCodeRef.current = stockCode
    setSelectedStockCodes(prev => {
      const next = new Set(prev)
      if (shiftKey && anchorStockCode && anchorStockCode !== stockCode) {
        const visibleItems = visibleItemsRef.current
        const anchorIndex = visibleItems.findIndex(item => item.stockCode === anchorStockCode)
        const clickedIndex = visibleItems.findIndex(item => item.stockCode === stockCode)
        // 기준 줄이 필터/정렬로 화면에서 사라졌으면 범위를 알 수 없으니 평소처럼 한 줄만 토글한다.
        if (anchorIndex >= 0 && clickedIndex >= 0) {
          // 범위 전체에 기준 줄의 지금 상태(선택됨/해제됨)를 적용한다 — 탐색기·메일 목록과 같은 방식.
          const select = prev.has(anchorStockCode)
          const from = Math.min(anchorIndex, clickedIndex)
          const to = Math.max(anchorIndex, clickedIndex)
          for (let i = from; i <= to; i++) {
            if (select) next.add(visibleItems[i].stockCode)
            else next.delete(visibleItems[i].stockCode)
          }
          return next
        }
      }
      if (next.has(stockCode)) next.delete(stockCode)
      else next.add(stockCode)
      return next
    })
  }, [noteMultiSelectUsed])

  const handleParentSectorHoverStart = useCallback(
    (stockCode: string) => setHoveredRow({ stockCode, kind: 'parentSector' }),
    [],
  )
  const handleMidSectorHoverStart = useCallback(
    (stockCode: string) => setHoveredRow({ stockCode, kind: 'midSector' }),
    [],
  )
  const handleSubSectorHoverStart = useCallback(
    (stockCode: string) => setHoveredRow({ stockCode, kind: 'subSector' }),
    [],
  )
  const handleAliasHoverStart = useCallback((stockCode: string) => setHoveredRow({ stockCode, kind: 'alias' }), [])
  const handleHoverEnd = useCallback(() => setHoveredRow(null), [])

  // 1차→2차→3차 단계형 일괄적용 공통 로직. 각 단계는 독립된 assign 호출이라(서버 입장에선 sectorId를
  // 여러 번 덮어쓰는 흐름이지만), 다음 단계 버튼에서 계속 이어서 좁혀나갈 수 있도록 선택은 유지한다.
  const runBulkAssign = (sectorId: number, onSuccessExtra?: () => void) => {
    const targets = [...selectedStockCodes]
    // 실행취소용으로 각 종목의 "변경 전" 섹터를 미리 스냅샷 — 일괄적용은 종목마다 원래 섹터가
    // 달랐을 수 있어서, 되돌릴 때도 종목별로 각자의 이전 값으로 복원해야 한다.
    const beforeByStockCode = new Map(targets.map(stockCode => [stockCode, itemsRef.current.find(item => item.stockCode === stockCode)?.sectorId]))
    bulkAssignStockSector.mutate(
      { stockCodes: targets, sectorId: sectorId },
      {
        onSuccess: result => {
          onSuccessExtra?.()
          const sectorName = sectorOptions.find(opt => opt.id === result.sectorId)?.name ?? ''
          const entries = targets
            .filter(stockCode => !result.failedStockCodes.includes(stockCode))
            .map(stockCode => ({ stockCode, before: beforeByStockCode.get(stockCode) }))
            .filter((entry): entry is { stockCode: string; before: number } => entry.before != null && entry.before !== sectorId)
          if (entries.length > 0) {
            pushUndo({ type: 'bulkSector', sectorName, after: sectorId, entries })
          }
          if (result.failedStockCodes.length === 0) {
            appAlert(`섹터: ${sectorName}\n일괄 적용 완료되었습니다.`)
          } else {
            appAlert(
              `섹터: ${sectorName}\n다음 종목은 반영되지 않았습니다:\n${result.failedStockCodes.join(', ')}`,
            )
          }
        },
      },
    )
  }

  const handleBulkAssignParent = (sectorId: number) => {
    runBulkAssign(sectorId, () => {
      setBulkParentId(sectorId)
      setBulkMidId(null)
    })
  }
  const handleBulkAssignMid = (sectorId: number) => {
    runBulkAssign(sectorId, () => setBulkMidId(sectorId))
  }
  const handleBulkAssignSub = (sectorId: number) => {
    runBulkAssign(sectorId)
  }

  const bulkParentOptions = sectorOptions.filter(opt => opt.parentId === null)
  const bulkMidOptions = bulkParentId != null ? sectorOptions.filter(opt => opt.parentId === bulkParentId) : []
  const bulkSubOptions = bulkMidId != null ? sectorOptions.filter(opt => opt.parentId === bulkMidId) : []

  // 표 위 검색창 — 종목명·코드·업종(대·중·소분류, 원래 분류) 중 하나라도 걸리면 남긴다.
  const [searchQuery, setSearchQuery] = useState('')
  const trimmedSearch = searchQuery.trim()
  const filtered = useMemo(() => {
    if (!trimmedSearch) return items
    return items.filter(item => {
      const display = displayByStockCode.get(item.stockCode)
      return [item.stockName, item.stockCode, display?.originCategoryName, display?.parentSectorName, display?.midSectorName, display?.subSectorName]
        .some(text => text?.includes(trimmedSearch))
    })
  }, [items, trimmedSearch, displayByStockCode])

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
    () => [...filtered].sort((a, b) => compareByKey(a, b, sortKey ?? DEFAULT_SORT_KEY, displayByStockCode)),
    [filtered, sortKey, displayByStockCode],
  )

  const sorted = useMemo(
    () => (sortKey && sortDirection === 'asc' ? sortedAscending : [...sortedAscending].reverse()),
    [sortedAscending, sortDirection, sortKey],
  )
  useEffect(() => {
    visibleItemsRef.current = sorted
  }, [sorted])

  // 지금 화면에 필터/정렬 적용된 상태 그대로 내려받는다 — 전체를 받고 싶으면 필터를 먼저 풀면 된다.
  const handleExportExcel = () => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const filename = `MARKETRY_LIST_${timestamp}.xlsx`
    const rows = sorted.map(item => {
      const display = displayByStockCode.get(item.stockCode)!
      return {
        종목코드: item.stockCode,
        종목명: item.stockName,
        ...(isAdmin ? { 약칭: item.alias ?? '' } : {}),
        시가총액: item.totalMarketValue ?? '',
        마켓: display.market,
        '업종': display.originCategoryName,
        '대분류': display.parentSectorName,
        '중분류': display.midSectorName,
        '소분류': display.subSectorName,
      }
    })
    exportRowsToExcel(filename, '종목관리', rows)
  }

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
    estimateSize: () => 29,
    overscan: 15,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom =
    virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0

  // 툴바 버튼은 테두리·채운 배경 없이 아이콘/글자만 둔다 — 올리면 옅은 배경이 깔리고, 비활성이면 흐려진다.
  const GHOST_BUTTON = 'flex h-6 items-center justify-center gap-1.5 rounded border-0 bg-transparent px-1.5 text-xs text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-300'
  // 세 번째 바(페이지 공통 상태/옵션 바) 높이(h-7=28px)에 맞춰야 해서, nes.css 기본 버튼 패딩(6px 8px)보다
  // 좁게 오버라이드한다 — 그 외 로직/상태는 전부 그대로다.
  // 실행취소·다시실행 아이콘 묶음.
  const historyControls = (
          <div className="flex items-center gap-2">
            <div
              ref={undoGroupRef}
              className="flex items-center gap-0.5"
            >
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className={GHOST_BUTTON}
                title="실행취소 (Ctrl+Z)"
                aria-label="실행취소"
              >
                <UndoIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsUndoListOpen(prev => !prev)}
                disabled={undoStack.length === 0}
                className={`${GHOST_BUTTON} !px-1 ${isUndoListOpen ? '!bg-white/10 !text-white' : ''}`}
                title="실행취소 목록"
              >
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <UndoRedoHistoryPopup
              isOpen={isUndoListOpen}
              setIsOpen={setIsUndoListOpen}
              triggerRef={undoGroupRef}
              actions={undoStack}
              direction="undo"
              items={items}
              sectorOptionsById={sectorOptionsById}
              onPick={handleUndoItem}
            />
            <div
              ref={redoGroupRef}
              className="flex items-center gap-0.5"
            >
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className={GHOST_BUTTON}
                title="다시실행 (Ctrl+Y)"
                aria-label="다시실행"
              >
                <RedoIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsRedoListOpen(prev => !prev)}
                disabled={redoStack.length === 0}
                className={`${GHOST_BUTTON} !px-1 ${isRedoListOpen ? '!bg-white/10 !text-white' : ''}`}
                title="다시실행 목록"
              >
                <ChevronDownIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <UndoRedoHistoryPopup
              isOpen={isRedoListOpen}
              setIsOpen={setIsRedoListOpen}
              triggerRef={redoGroupRef}
              actions={redoStack}
              direction="redo"
              items={items}
              sectorOptionsById={sectorOptionsById}
              onPick={handleRedoItem}
            />
          </div>
  )

  const toolbar = (
    <div className="flex h-full min-h-0 w-full items-center justify-between gap-3">
        {/* 실행취소·다시실행은 설정창 안(historyContainer)에 그린다 — 컨테이너가 없으면 이 자리에 그대로 그린다. */}
        {!historyContainer && historyControls}
        <div className="flex items-center gap-2">
          {selectedStockCodes.size > 0 && (
            <>
              <BulkAssignButton
                count={selectedStockCodes.size}
                options={bulkParentOptions}
                onAssign={handleBulkAssignParent}
                alignRight
                widthPx={bulkButtonWidths?.parent}
              />
              <BulkAssignButton
                count={selectedStockCodes.size}
                options={bulkMidOptions}
                onAssign={handleBulkAssignMid}
                alignRight
                widthPx={bulkButtonWidths?.mid}
                disabled={bulkParentId == null}
                disabledHint="대분류를 먼저 일괄적용하세요"
              />
              <BulkAssignButton
                count={selectedStockCodes.size}
                options={bulkSubOptions}
                onAssign={handleBulkAssignSub}
                alignRight
                widthPx={bulkButtonWidths?.sub}
                disabled={bulkMidId == null}
                disabledHint="중분류를 먼저 일괄적용하세요"
              />
            </>
          )}
        </div>
    </div>
  )

  useReportCountLabel(`${toCount(sorted.length)}/${toCount(items.length)}종목`, onCountLabelChange)
  return (
    <div className="flex h-full min-h-0 flex-col">
      {toolbarContainer && createPortal(toolbar, toolbarContainer)}
      {historyContainer && createPortal(
        <div>
          <h2 className="mb-3 text-[15px] font-medium leading-[22px] text-white">실행 취소</h2>
          {historyControls}
        </div>,
        historyContainer,
      )}
      <SearchBar
        query={searchQuery}
        onChange={setSearchQuery}
        placeholder="종목명·코드·업종 검색"
        ariaLabel="종목 검색"
        extra={
          <button
            type="button"
            onClick={handleExportExcel}
            // 버튼 폭을 상단 바의 설정(톱니) 버튼과 같은 28px로 맞춰서, 설정창을 닫았을 때 아이콘의 가로 위치가 톱니와 같게 한다.
            className="-mr-[7px] flex h-6 w-7 items-center justify-center rounded border-0 bg-transparent p-0 transition-colors hover:bg-white/10"
            title="지금 화면에 보이는(필터/정렬 적용된) 목록을 엑셀로 내려받습니다"
            aria-label="엑셀 다운로드"
          >
            <ExcelIcon className="h-6 w-6" />
          </button>
        }
      />
      {/* 바깥 테두리(외곽선)는 두지 않는다 — KRX·NXT 시트와 같은 모양이다. */}
      <div className="relative min-h-0 flex-1">
        {isSelectionHintOpen && (
          <div
            role="status"
            className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-md border border-slate-500 bg-[#2b3a4f] px-4 py-2 text-sm text-slate-100 shadow-lg"
          >
            <span>
              여러 줄은 <b className="text-[var(--brand)]">드래그</b>하거나 <b className="text-[var(--brand)]">Shift + 클릭</b>으로 한 번에 선택할 수 있어요.
            </span>
            <button
              type="button"
              onClick={() => setIsSelectionHintOpen(false)}
              aria-label="안내 닫기"
              className="border-0 bg-transparent p-0 text-slate-400 hover:text-slate-100"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div ref={scrollContainerRef} className="relative h-full overflow-auto scrollbar-thin">
          {/* 표 글자는 드래그해도 파랗게 선택되지 않게 한다(줄 드래그 선택과 겹치기 때문). 입력창 안의 글자는 그대로 선택할 수 있다. */}
          <table className="nes-table is-dark custom-page-table w-full select-none text-sm [&_input]:select-text [border-collapse:separate] [border-spacing:0] [&_td]:border-slate-700 [&_td]:py-1 [&_th]:border-white/15 [&_th]:border-b-0 [&_th]:py-1">
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                className="cursor-pointer bg-[#2b3a4f] px-0 text-center font-bold text-slate-100"
                style={CHECKBOX_CELL_STYLE}
                onClick={e => {
                  // 체크박스 자신을 클릭한 경우는 onChange가 이미 처리하므로 여기서 중복 토글하지 않는다.
                  if ((e.target as HTMLElement).tagName === 'INPUT') return
                  toggleSelectAllVisible()
                }}
              >
                <input type="checkbox" className="mx-auto my-0 block h-5 w-5 cursor-pointer accent-[var(--brand)]" checked={isAllVisibleSelected} onChange={toggleSelectAllVisible} />
              </th>
              {columns.map(col => {
                const label = (
                  <span
                    className={`cursor-pointer select-none text-slate-100 hover:text-slate-300 ${col.key === 'alias' ? 'inline-flex items-center align-middle' : ''}`}
                    title={col.key === 'alias' ? '운영자 권한이 있는 사용자만 약칭을 보고 수정할 수 있습니다.' : undefined}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.key === 'alias' && (
                      <span className="mr-2 inline-flex h-4 items-center bg-[#ff4d2e] px-1 text-[10px] font-extrabold leading-none text-white">ADMIN</span>
                    )}
                    {col.header}
                    <span className={`ml-1 inline-flex align-middle ${sortKey === col.key ? 'text-[var(--brand)]' : 'text-slate-500'}`}>
                      <SortIcon active={sortKey === col.key} direction={sortDirection} className="h-3.5 w-3.5" />
                    </span>
                  </span>
                )
                return (
                  <th
                    key={col.key}
                    ref={
                      col.key === 'parentSectorName'
                        ? parentThRef
                        : col.key === 'midSectorName'
                          ? midThRef
                          : col.key === 'subSectorName'
                            ? subThRef
                            : undefined
                    }
                    style={{ width: col.key === columns[columns.length - 1].key ? undefined : col.width }}
                    className="whitespace-nowrap bg-[#2b3a4f] text-center font-bold text-slate-100"
                  >
                    {col.key === 'totalMarketValue' ? (
                      <>
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
                      </>
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
                <td colSpan={columns.length + 1} className="p-8">
                  {/* 지도·그룹 페이지처럼 크게 가운데에 보여준다. */}
                  <div className="flex h-[min(32rem,60vh)] items-center justify-center">
                    <Spinner showElapsed />
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} style={{ height: paddingTop, padding: 0, border: 'none' }} />
                  </tr>
                )}
                {virtualRows.map(virtualRow => {
                  const item = sorted[virtualRow.index]
                  return (
                    <AdminStockRow
                      key={item.stockCode}
                      showAlias={isAdmin}
                      item={item}
                      index={virtualRow.index}
                      isSelected={selectedStockCodes.has(item.stockCode)}
                      onToggleSelected={toggleSelected}
                      onRowMouseDown={handleRowMouseDown}
                      hoveredKind={hoveredRow?.stockCode === item.stockCode ? hoveredRow.kind : null}
                      onParentSectorHoverStart={handleParentSectorHoverStart}
                      onMidSectorHoverStart={handleMidSectorHoverStart}
                      onSubSectorHoverStart={handleSubSectorHoverStart}
                      onAliasHoverStart={handleAliasHoverStart}
                      onHoverEnd={handleHoverEnd}
                      sectorOptions={sectorOptions}
                      sectorOptionsById={sectorOptionsById}
                      onAssign={handleAssign}
                      onUpdateAlias={handleUpdateAlias}
                    />
                  )
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} style={{ height: paddingBottom, padding: 0, border: 'none' }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
          </table>
          {/* 보여줄 종목이 없으면 한국거래소·MARKETRY 표와 같은 안내 글을 가운데에 보여준다. */}
          {!isPending && sorted.length === 0 && <EmptyMessage message={items.length === 0 ? EMPTY_DATA_MESSAGE : EMPTY_SEARCH_MESSAGE} />}
        </div>
      </div>
    </div>
  )
}
