import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useReportCountLabel } from '@/hooks/useReportCountLabel'
import { useRowRangeSelection } from '@/hooks/useRowRangeSelection'
import { STOCK_COLUMN_PERCENT, stockColumnPercentWidth } from '@/utils/stockTableColumns'
import { useVirtualizer } from '@tanstack/react-virtual'
import Spinner from '@/components/Spinner'
import type { Market, MarketMapResponse } from '@/types/api'
import { toCount, toJoEokDecimal } from '@/utils/format'
import { charTier } from '@/utils/koreanSort'
import { SortIcon } from '@/components/icons/MarketMapIcons'

const KOREAN_COLLATOR = new Intl.Collator('ko')
const MARKET_LABEL: Record<Market, string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }

function compareName(a: string, b: string): number {
  const tierA = charTier(a[0] ?? '')
  const tierB = charTier(b[0] ?? '')
  if (tierA !== tierB) return tierA - tierB
  return KOREAN_COLLATOR.compare(a, b)
}

// 열 가운데에 놓되 숫자는 오른쪽 정렬 — 고정 폭 상자를 가운데에 두고 그 안에서 오른쪽 정렬하므로 자릿수가 달라도 끝이 맞는다.
function CenteredRightNumber({ value }: { value: number }) {
  return <span className="mx-auto block w-[6ch] text-right tabular-nums">{toCount(value)}</span>
}

// 이 시트 전용 색 — MARKETRY 표(커스텀 종목 표)의 강조색·노란 화살표를 가져다 쓰지 않는다. MARKETRY 색을 바꿔도
// 이 시트가 따라 바뀌지 않도록 색은 전부 여기 모아 두었다. 시트 색을 바꿀 때도 여기만 고치면 된다.
// Tailwind는 완성된 클래스 이름만 인식하므로, 클래스를 문자열로 조립하지 말고 아래처럼 통째로 적는다.
const COLOR = {
  headerBg: 'bg-[#2b3a4f]',
  headerText: 'text-slate-100',
  rowDivider: 'border-slate-700',
  sortActive: 'text-[var(--brand)]',
  sortInactive: 'text-slate-500',
  sortHover: 'hover:text-slate-300',
} as const

// 열 사이 세로 구분선 — 마지막 열 오른쪽에는 긋지 않는다. 머리글은 밝은 선, 본문은 어두운 선이다.
const TABLE_CLASS =
  'w-full border-separate border-spacing-0 [&_th:not(:last-child)]:border-r [&_th:not(:last-child)]:border-white/15 [&_td:not(:last-child)]:border-r [&_td:not(:last-child)]:border-slate-700'

type SortDirection = 'asc' | 'desc'

// 머리글을 눌러 정렬한다 — 같은 열을 다시 누르면 오름/내림차순이 바뀌고, 다른 열을 누르면 그 열의 오름차순으로 시작한다
// (커스텀 종목 표와 같은 방식).
function useSort<K extends string>(initialKey: K, initialDirection: SortDirection) {
  const [sortKey, setSortKey] = useState<K>(initialKey)
  const [direction, setDirection] = useState<SortDirection>(initialDirection)
  const toggle = (key: K) => {
    if (key === sortKey) {
      setDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setDirection('asc')
    }
  }
  return { sortKey, direction, toggle }
}

function SortableHeader({ label, active, direction, onClick }: {
  label: string
  active: boolean
  direction: SortDirection
  onClick: () => void
}) {
  return (
    <th className={HEADER_CELL}>
      <span className={`cursor-pointer select-none ${COLOR.sortHover}`} onClick={onClick}>
        {label}
        <span className={`ml-1 inline-flex align-middle ${active ? COLOR.sortActive : COLOR.sortInactive}`}>
          <SortIcon active={active} direction={direction} className="h-3.5 w-3.5" />
        </span>
      </span>
    </th>
  )
}

const HEADER_CELL = `sticky top-0 z-10 ${COLOR.headerBg} px-3 py-1 text-center text-sm font-bold ${COLOR.headerText}`
const BODY_CELL = `border-b ${COLOR.rowDivider} px-3 py-1 text-sm`
// 종목 표 한 행의 예상 높이(글줄 20 + 위아래 여백 8 + 아래 선 1) — 실제 높이는 렌더 뒤에 다시 잰다.
const STOCK_ROW_HEIGHT = 29
// 맨 왼쪽 체크박스 칸 — MARKETRY 종목 표(AdminStockTable)와 같은 폭(체크박스 20px + 좌우 4.5px씩)이다.
const CHECKBOX_COLUMN_WIDTH = '29px'
const CHECKBOX_CELL_STYLE = { width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH, maxWidth: CHECKBOX_COLUMN_WIDTH, paddingLeft: 0, paddingRight: 0 } as const

interface Props {
  mode: 'category' | 'stock'
  data: MarketMapResponse | undefined
  isLoading: boolean
  // 어떤 분류를 읽기 전용으로 보여주는지 — krx는 거래소 분류, marketry는 운영자가 올린 분류다. "NXT만 보기"는 krx만 쓴다.
  source: 'krx' | 'marketry'
  // NXT 시트면 NXT 거래 가능 종목만 남긴다. 업종 분류는 KRX 것을 그대로 쓴다.
  nxtOnly: boolean
  // 검색창 옆 "NXT만 보기" 체크박스를 눌렀을 때.
  onNxtOnlyChange: (nxtOnly: boolean) => void
  // NXT 거래 가능 종목코드 — 지도 응답에는 이 정보가 없어서 커스텀 종목 목록(/custom/stock-sectors)에서 받아온다.
  nxtStockCodes: ReadonlySet<string>
  // 지도 응답에는 마켓 정보가 없어 MARKETRY 표와 같은 커스텀 종목 목록에서 가져온다.
  stockMarkets: ReadonlyMap<string, Market>
  // nxtStockCodes를 아직 받아오는 중인지 — 받기 전에는 "종목이 없다"고 잘못 보이지 않게 스피너를 보여준다.
  isNxtLoading: boolean
  // 검색창 옆에 두던 "27/27업종" 개수를 받아 갈 곳 — 페이지가 설정창 머리글에 그려 준다.
  onCountLabelChange?: (label: string | undefined) => void
}

interface SectorRow {
  sectorName: string
  stocks: MarketMapResponse['items'][number]['items']
}

// KRX/NXT·MARKETRY 시트 — 업종 분류를 읽기만 하는 화면이다. 편집 기능(추가·이동·배정)은 없고, 지도의 해당 히트맵이 보여주는
// 분류(/map?source=...)를 그대로 표로 보여준다. 시세가 있는 종목만 내려오므로 거래정지 종목 등은 빠질 수 있다.
export default function ReadOnlyHeatmapSheet({ mode, data, isLoading, source, nxtOnly, onNxtOnlyChange, nxtStockCodes, stockMarkets, isNxtLoading, onCountLabelChange }: Props) {
  const sectors = useMemo<SectorRow[]>(() => {
    if (!data) return []
    return data.items
      .map(node => ({
        sectorName: node.sectorName,
        stocks: nxtOnly ? node.items.filter(item => nxtStockCodes.has(item.stockCode)) : node.items,
      }))
      .filter(row => row.stocks.length > 0)
  }, [data, nxtOnly, nxtStockCodes])

  // NXT 열(종목 화면)과 NXT만 보기는 NXT 종목 목록이 와야 맞게 보이므로 그동안 스피너를 보여준다.
  if (isLoading || ((nxtOnly || mode === 'stock') && isNxtLoading)) {
    return (
      <div className="flex justify-center p-16">
        <Spinner />
      </div>
    )
  }
  // 종목이 하나도 없어도 표 틀(검색창·머리글)은 그대로 보여준다 — 시트마다 화면 모양이 달라 보이지 않게 한다.
  const emptyMessage = source === 'marketry'
    ? 'MARKETRY 분류가 아직 없습니다.'
    : nxtOnly
      ? 'NXT 거래 종목이 아직 없습니다.\n평일 오전 7시 종목 정보 동기화 뒤에 표시됩니다.'
      : '표시할 KRX 분류가 없습니다.'
  const nxtOnlyToggle = source === 'krx' && (
    <label className="flex cursor-pointer items-center gap-1.5 text-sm text-white">
      <input
        type="checkbox"
        className="m-0 h-4 w-4 cursor-pointer accent-[var(--brand)]"
        checked={nxtOnly}
        onChange={event => onNxtOnlyChange(event.target.checked)}
      />
      NXT
    </label>
  )
  return mode === 'stock' ? (
    <StockTable sectors={sectors} emptyMessage={emptyMessage} nxtStockCodes={nxtStockCodes} stockMarkets={stockMarkets} extra={nxtOnlyToggle} onCountLabelChange={onCountLabelChange} />
  ) : (
    <CategoryTable sectors={sectors} emptyMessage={emptyMessage} extra={nxtOnlyToggle} onCountLabelChange={onCountLabelChange} />
  )
}

// 표 위의 검색창과 개수 — 카테고리·종목 화면이 같은 틀(위치·크기)을 쓰도록 한 곳에 둔다. 커스텀 종목 표도 이걸 쓴다.
export function SearchBar({ query, onChange, placeholder, ariaLabel, countLabel, extra, settingsLayout = false }: {
  query: string
  onChange: (query: string) => void
  placeholder: string
  ariaLabel: string
  countLabel?: string
  settingsLayout?: boolean
  // 개수 오른쪽 끝에 붙는 추가 조작(예: "NXT만 보기" 체크박스).
  extra?: ReactNode
}) {
  return (
    <div className={settingsLayout ? 'mb-6 flex min-w-0 flex-col gap-2' : 'flex shrink-0 items-center pl-2 pr-[18px] pb-2'}>
      <input
        type="text"
        value={query}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`nes-input is-dark ${settingsLayout ? 'h-8 w-full text-sm' : 'h-7 w-[15.5rem] text-sm'}`}
        // 안내 문구와 입력 글자가 위 드롭박스의 글자와 같은 선에서 시작하게 한다: 드롭박스 안쪽 여백(0.5rem)에서
        // 이 입력창의 테두리(1px)만큼 뺀다. 유틸리티 클래스는 nes.css보다 약해서 인라인으로 준다.
        style={{ paddingLeft: 'calc(0.5rem - 1px)' }}
      />
      {/* 개수는 위 헤더의 "읽기 전용"과 같은 위치에서 시작한다: 드롭박스 둘(15.5rem) + 간격(0.5rem) + "읽기 전용"의 왼쪽 여백(0.75rem)
          = 16.75rem이고, 검색창이 15.5rem이므로 사이에 1.25rem을 둔다. */}
      {countLabel && <span className={settingsLayout ? 'text-xs text-gray-400' : 'ml-5 text-sm text-gray-400'}>{countLabel}</span>}
      {extra && <div className="ml-auto flex items-center">{extra}</div>}
    </div>
  )
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="whitespace-pre-line px-3 py-8 text-center text-sm text-gray-400">
        {message}
      </td>
    </tr>
  )
}

type CategorySortKey = 'name' | 'stockCount' | 'marketValue'

function CategoryTable({ sectors, emptyMessage, extra, onCountLabelChange }: { sectors: SectorRow[]; emptyMessage: string; extra: ReactNode; onCountLabelChange?: (label: string | undefined) => void }) {
  const [query, setQuery] = useState('')
  const { sortKey, direction, toggle } = useSort<CategorySortKey>('name', 'asc')
  const rows = useMemo(() => {
    const sign = direction === 'asc' ? 1 : -1
    return sectors
      .map(sector => ({
        name: sector.sectorName,
        stockCount: sector.stocks.length,
        marketValue: sector.stocks.reduce((sum, stock) => sum + stock.totalMarketValue, 0),
      }))
      .sort((a, b) => {
        const diff = sortKey === 'name' ? compareName(a.name, b.name) : a[sortKey] - b[sortKey]
        return diff === 0 ? compareName(a.name, b.name) : sign * diff
      })
  }, [sectors, sortKey, direction])
  const header = (key: CategorySortKey, label: string) => (
    <SortableHeader label={label} active={sortKey === key} direction={direction} onClick={() => toggle(key)} />
  )
  const trimmed = query.trim()
  const visibleRows = trimmed ? rows.filter(row => row.name.includes(trimmed)) : rows
  useReportCountLabel(`${toCount(visibleRows.length)}/${toCount(rows.length)}업종`, onCountLabelChange)
  return (
    <div className="flex min-h-0 flex-1 flex-col text-white">
      <SearchBar
        query={query}
        onChange={setQuery}
        placeholder="업종 검색"
        ariaLabel="업종 검색"
        extra={extra}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 업종·종목 수·시가총액 세 칸을 같은 폭(삼등분)으로 나눈다 — MARKETRY 업종 화면의 대·중·소분류 칸과 같은 모양이다. */}
        <table className={`${TABLE_CLASS} table-fixed select-none`}>
          <thead>
            <tr>
              {header('name', '업종')}
              {header('stockCount', '종목 수')}
              {header('marketValue', '시가총액')}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && <EmptyRow colSpan={3} message={rows.length === 0 ? emptyMessage : '검색 결과가 없습니다.'} />}
            {visibleRows.map(row => (
              <tr key={row.name} className="text-gray-400">
                {/* 업종 이름 시작 위치를 MARKETRY 업종 화면의 대분류 이름과 같게 한다 — 칸 왼쪽에서 8px(여백) + 손잡이 24px + 4px + 번호 칸 28px + 8px = 72px. */}
                <td className={`${BODY_CELL} truncate text-left !pl-[72px]`}>{row.name}</td>
                <td className={BODY_CELL}>
                  <CenteredRightNumber value={row.stockCount} />
                </td>
                {/* 종목 표와 같은 시가총액 표기('137조 2,762억' 대신 '137.3조')와 오른쪽 정렬이다. */}
                <td className={`${BODY_CELL} text-right !pr-4 text-gray-400`}>{toJoEokDecimal(row.marketValue / 100_000_000)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type StockSortKey = 'stockCode' | 'stockName' | 'sectorName' | 'totalMarketValue' | 'market'

function StockTable({ sectors, emptyMessage, nxtStockCodes, stockMarkets, extra, onCountLabelChange }: { sectors: SectorRow[]; emptyMessage: string; nxtStockCodes: ReadonlySet<string>; stockMarkets: ReadonlyMap<string, Market>; extra: ReactNode; onCountLabelChange?: (label: string | undefined) => void }) {
  const [query, setQuery] = useState('')
  const { sortKey, direction, toggle } = useSort<StockSortKey>('totalMarketValue', 'desc')
  const rows = useMemo(() => {
    const sign = direction === 'asc' ? 1 : -1
    return sectors
      .flatMap(sector => sector.stocks.map(stock => ({ ...stock, sectorName: sector.sectorName, market: stockMarkets.get(stock.stockCode) })))
      .sort((a, b) => {
        const diff =
          sortKey === 'totalMarketValue'
            ? a.totalMarketValue - b.totalMarketValue
            : sortKey === 'market'
              ? compareName(a.market ? MARKET_LABEL[a.market] : '-', b.market ? MARKET_LABEL[b.market] : '-')
              : compareName(a[sortKey], b[sortKey])
        return diff === 0 ? a.stockCode.localeCompare(b.stockCode) : sign * diff
      })
  }, [sectors, stockMarkets, sortKey, direction])
  const header = (key: StockSortKey, label: string) => (
    <SortableHeader label={label} active={sortKey === key} direction={direction} onClick={() => toggle(key)} />
  )
  const trimmed = query.trim()
  const visibleRows = trimmed
    ? rows.filter(row => row.stockName.includes(trimmed) || row.stockCode.includes(trimmed) || row.sectorName.includes(trimmed))
    : rows
  useReportCountLabel(`${toCount(visibleRows.length)}/${toCount(rows.length)}종목`, onCountLabelChange)
  // 맨 왼쪽 체크박스 — MARKETRY 종목 표와 같은 모양이다. 읽기 전용 시트라 고른 종목으로 할 수 있는 작업은 아직 없고, 표시만 한다.
  const [selectedCodes, setSelectedCodes] = useState<ReadonlySet<string>>(new Set())
  const isAllVisibleSelected = visibleRows.length > 0 && visibleRows.every(row => selectedCodes.has(row.stockCode))
  const toggleSelectAllVisible = () =>
    setSelectedCodes(isAllVisibleSelected ? new Set() : new Set(visibleRows.map(row => row.stockCode)))
  // 종목이 수천 개라 전부 그려 두면 검색할 때마다 화면 갱신이 느리고, 공유 캡처도 안 보이는 행까지 전부 복제한다 —
  // 화면에 보이는 행(+위아래 여유)만 그리고, 나머지 높이는 앞뒤 스페이서 <tr>로 채운다(AdminStockTable과 같은 방식).
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // 줄 누르기·Shift+클릭 범위·끌어서 연속 선택 — MARKETRY 종목 표와 같은 동작이다.
  const { rowProps } = useRowRangeSelection(
    useMemo(() => visibleRows.map(row => row.stockCode), [visibleRows]),
    scrollContainerRef,
    selectedCodes,
    setSelectedCodes,
  )
  // eslint-disable-next-line react-hooks/incompatible-library -- 가상화 라이브러리의 함수는 메모하지 못한다는 경고 — AdminStockTable과 같은 사용 방식이라 무시한다
  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => STOCK_ROW_HEIGHT,
    overscan: 15,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom = virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0
  // 검색어나 정렬이 바뀌면 맨 위로 — 결과가 줄었는데 예전 스크롤 위치에 남으면 빈 화면이 보인다.
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 })
  }, [trimmed, sortKey, direction])
  return (
    <div className="flex min-h-0 flex-1 flex-col text-white">
      <SearchBar
        query={query}
        onChange={setQuery}
        placeholder="종목명·코드·업종 검색"
        ariaLabel="종목 검색"
        extra={extra}
      />
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto">
        {/* 열 너비는 MARKETRY 종목 표와 같은 비율이다 — 종목명은 그쪽의 "종목명 + 약칭" 너비이고, 남는 폭은 NXT 칸이 받는다. */}
        {/* 열이 MARKETRY 표 폭으로 좁아져도 머리글·시가총액이 두 줄로 접히거나 옆 칸으로 넘치지 않게 좌우 여백을 줄이고 한 줄로 고정한다. */}
        <table className={`${TABLE_CLASS} table-fixed select-none [&_td]:whitespace-nowrap [&_td]:px-1 [&_th]:whitespace-nowrap [&_th]:px-1`}>
          <colgroup>
            <col style={{ width: CHECKBOX_COLUMN_WIDTH }} />
            <col style={{ width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.stockCode) }} />
            <col style={{ width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.stockName + STOCK_COLUMN_PERCENT.alias) }} />
            <col style={{ width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.totalMarketValue) }} />
            <col style={{ width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.market) }} />
            <col style={{ width: stockColumnPercentWidth(STOCK_COLUMN_PERCENT.industry) }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th className={`${HEADER_CELL} cursor-pointer`} style={CHECKBOX_CELL_STYLE} onClick={toggleSelectAllVisible}>
                <input
                  type="checkbox"
                  aria-label="보이는 종목 전체 선택"
                  className="mx-auto my-0 block h-5 w-5 cursor-pointer accent-[var(--brand)]"
                  checked={isAllVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  onClick={event => event.stopPropagation()}
                />
              </th>
              {header('stockCode', '종목코드')}
              {header('stockName', '종목명')}
              {header('totalMarketValue', '시가총액')}
              {header('market', '마켓')}
              {header('sectorName', '업종')}
              <th className={HEADER_CELL}>NXT</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && <EmptyRow colSpan={7} message={rows.length === 0 ? emptyMessage : '검색 결과가 없습니다.'} />}
            {paddingTop > 0 && (
              <tr>
                <td colSpan={7} style={{ height: paddingTop, padding: 0, border: 'none' }} />
              </tr>
            )}
            {virtualRows.map(virtualRow => {
              const row = visibleRows[virtualRow.index]
              const isKosdaq = row.market === 'KOSDAQ'
              return (
                <tr key={row.stockCode} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} {...rowProps(virtualRow.index)} className={`cursor-pointer text-gray-400 ${selectedCodes.has(row.stockCode) ? '[&>td]:bg-[var(--brand)]/35' : '[&:hover>td]:bg-[var(--brand)]/10'}`}>
                  <td className={`${BODY_CELL} text-center`} style={CHECKBOX_CELL_STYLE}>
                    <input
                      type="checkbox"
                      aria-label={`${row.stockName} 선택`}
                      className="mx-auto my-0 block h-5 w-5 cursor-pointer accent-[var(--brand)]"
                      checked={selectedCodes.has(row.stockCode)}
                      onChange={() => {}}
                    />
                  </td>
                  <td className={`${BODY_CELL} text-center`}>{row.stockCode}</td>
                  <td className={`${BODY_CELL} truncate text-left !pl-4 ${isKosdaq ? 'text-[var(--brand)]' : ''}`}>{row.stockName}</td>
                  {/* MARKETRY 종목 표와 같은 표기('1,613.6조')와 오른쪽 정렬이다. */}
                  <td className={`${BODY_CELL} text-right !pr-4 text-gray-400`}>{toJoEokDecimal(row.totalMarketValue / 100_000_000)}</td>
                  <td className={`${BODY_CELL} text-center ${isKosdaq ? 'text-[var(--brand)]' : ''}`}>
                    {row.market ? MARKET_LABEL[row.market] : '-'}
                  </td>
                  {/* 업종 글자 시작 위치(칸 왼쪽에서 16px)를 MARKETRY 종목 표의 업종 칸과 같게 한다. */}
                  <td className={`${BODY_CELL} truncate text-left !pl-4`}>{row.sectorName}</td>
                  <td className={`${BODY_CELL} text-center ${!nxtStockCodes.has(row.stockCode) ? 'text-gray-500' : ''}`}>
                    {nxtStockCodes.has(row.stockCode) ? 'O' : '-'}
                  </td>
                </tr>
              )
            })}
            {paddingBottom > 0 && (
              <tr>
                <td colSpan={7} style={{ height: paddingBottom, padding: 0, border: 'none' }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
