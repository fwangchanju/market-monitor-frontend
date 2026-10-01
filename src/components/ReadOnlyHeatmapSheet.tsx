import { useMemo, useState } from 'react'
import Spinner from '@/components/Spinner'
import type { MarketMapResponse } from '@/types/api'
import { toCount } from '@/utils/format'
import { charTier } from '@/utils/koreanSort'

const KOREAN_COLLATOR = new Intl.Collator('ko')

function compareName(a: string, b: string): number {
  const tierA = charTier(a[0] ?? '')
  const tierB = charTier(b[0] ?? '')
  if (tierA !== tierB) return tierA - tierB
  return KOREAN_COLLATOR.compare(a, b)
}

// 지도 응답의 시가총액은 원 단위 — 표에는 '조/억'으로 보여준다. 조와 억을 따로 오른쪽 정렬한 고정 폭 칸에 넣어서,
// 줄마다 자릿수가 달라도 "조"와 "억" 글자가 같은 세로선에 놓이게 한다(숫자 폭은 tabular-nums로 맞춘다).
// 열 가운데에 놓되 글자는 왼쪽 정렬 — 고정 폭 상자를 가운데에 두고 그 안에서 왼쪽 정렬하므로, 줄마다 글자가 시작하는
// 위치가 같다. 폭을 넘는 글자는 줄임표로 자른다.
function CenteredLeft({ children }: { children: string }) {
  return <span className="mx-auto block w-[12rem] truncate text-left">{children}</span>
}

// 열 가운데에 놓되 숫자는 오른쪽 정렬 — 고정 폭 상자를 가운데에 두고 그 안에서 오른쪽 정렬하므로 자릿수가 달라도 끝이 맞는다.
function CenteredRightNumber({ value }: { value: number }) {
  return <span className="mx-auto block w-[6ch] text-right tabular-nums">{toCount(value)}</span>
}

function MarketValueCell({ won }: { won: number }) {
  const totalEok = Math.round(won / 100_000_000)
  const jo = Math.floor(totalEok / 10_000)
  const eok = totalEok % 10_000
  return (
    <span className="inline-flex tabular-nums">
      <span className="w-[7ch] text-right">{jo > 0 ? `${toCount(jo)}조` : ''}</span>
      <span className="w-[7ch] text-right">{`${toCount(eok)}억`}</span>
    </span>
  )
}

// 이 시트 전용 색 — MARKETRY 표(커스텀 종목 표)의 강조색·노란 화살표를 가져다 쓰지 않는다. MARKETRY 색을 바꿔도
// 이 시트가 따라 바뀌지 않도록 색은 전부 여기 모아 두었다. 시트 색을 바꿀 때도 여기만 고치면 된다.
// Tailwind는 완성된 클래스 이름만 인식하므로, 클래스를 문자열로 조립하지 말고 아래처럼 통째로 적는다.
const COLOR = {
  headerBg: 'bg-[#2b3a4f]',
  headerText: 'text-slate-100',
  rowDivider: 'border-slate-800',
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
        <span className={`ml-1 ${active ? COLOR.sortActive : COLOR.sortInactive}`}>{active && direction === 'asc' ? '▲' : '▼'}</span>
      </span>
    </th>
  )
}

const HEADER_CELL = `sticky top-0 z-10 ${COLOR.headerBg} px-3 py-1 text-center text-sm font-bold ${COLOR.headerText}`
const BODY_CELL = `border-b ${COLOR.rowDivider} px-3 py-1 text-sm`

interface Props {
  mode: 'category' | 'stock'
  data: MarketMapResponse | undefined
  isLoading: boolean
  // NXT 시트면 NXT 거래 가능 종목만 남긴다. 업종 분류는 KRX 것을 그대로 쓴다.
  nxtOnly: boolean
  // NXT 거래 가능 종목코드 — 지도 응답에는 이 정보가 없어서 커스텀 종목 목록(/custom/stock-sectors)에서 받아온다.
  nxtStockCodes: ReadonlySet<string>
  // nxtStockCodes를 아직 받아오는 중인지 — 받기 전에는 "종목이 없다"고 잘못 보이지 않게 스피너를 보여준다.
  isNxtLoading: boolean
}

interface SectorRow {
  sectorName: string
  stocks: MarketMapResponse['items'][number]['items']
}

// KRX/NXT 시트 — 업종 분류를 읽기만 하는 화면이다. 편집 기능(추가·이동·배정)은 없고, 지도의 KRX 히트맵이 보여주는
// 분류(/map?isCustom=false)를 그대로 표로 보여준다. 시세가 있는 종목만 내려오므로 거래정지 종목 등은 빠질 수 있다.
export default function ReadOnlyHeatmapSheet({ mode, data, isLoading, nxtOnly, nxtStockCodes, isNxtLoading }: Props) {
  const sectors = useMemo<SectorRow[]>(() => {
    if (!data) return []
    return data.items
      .map(node => ({
        sectorName: node.sectorName,
        stocks: nxtOnly ? node.items.filter(item => nxtStockCodes.has(item.stockCode)) : node.items,
      }))
      .filter(row => row.stocks.length > 0)
  }, [data, nxtOnly, nxtStockCodes])

  if (isLoading || (nxtOnly && isNxtLoading)) {
    return (
      <div className="flex justify-center p-16">
        <Spinner />
      </div>
    )
  }
  // 종목이 하나도 없어도 표 틀(검색창·머리글)은 그대로 보여준다 — 시트마다 화면 모양이 달라 보이지 않게 한다.
  const emptyMessage = nxtOnly ? 'NXT 거래 종목이 아직 없습니다.\n평일 오전 7시 종목 정보 동기화 뒤에 표시됩니다.' : '표시할 KRX 분류가 없습니다.'
  return mode === 'stock' ? (
    <StockTable sectors={sectors} emptyMessage={emptyMessage} />
  ) : (
    <CategoryTable sectors={sectors} emptyMessage={emptyMessage} />
  )
}

// 표 위의 검색창과 개수 — 카테고리·종목 화면이 같은 틀(위치·크기)을 쓰도록 한 곳에 둔다.
function SearchBar({ query, onChange, placeholder, ariaLabel, countLabel }: {
  query: string
  onChange: (query: string) => void
  placeholder: string
  ariaLabel: string
  countLabel: string
}) {
  return (
    <div className="flex shrink-0 items-center pl-2 pr-3 pb-2">
      <input
        type="text"
        value={query}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="nes-input is-dark h-7 w-[15.5rem] text-sm"
        // 안내 문구와 입력 글자가 위 드롭박스의 글자와 같은 선에서 시작하게 한다: 드롭박스 안쪽 여백(0.5rem)에서
        // 이 입력창의 테두리(1px)만큼 뺀다. 유틸리티 클래스는 nes.css보다 약해서 인라인으로 준다.
        style={{ paddingLeft: 'calc(0.5rem - 1px)' }}
      />
      {/* 개수는 위 헤더의 "읽기 전용"과 같은 위치에서 시작한다: 드롭박스 둘(15.5rem) + 간격(0.5rem) + "읽기 전용"의 왼쪽 여백(0.75rem)
          = 16.75rem이고, 검색창이 15.5rem이므로 사이에 1.25rem을 둔다. */}
      <span className="ml-5 text-sm text-gray-400">{countLabel}</span>
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

function CategoryTable({ sectors, emptyMessage }: { sectors: SectorRow[]; emptyMessage: string }) {
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
  return (
    <div className="flex min-h-0 flex-1 flex-col text-white">
      <SearchBar
        query={query}
        onChange={setQuery}
        placeholder="업종 검색"
        ariaLabel="업종 검색"
        countLabel={`${toCount(visibleRows.length)}/${toCount(rows.length)}업종`}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className={TABLE_CLASS}>
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
              <tr key={row.name}>
                <td className={BODY_CELL}>
                  <CenteredLeft>{row.name}</CenteredLeft>
                </td>
                <td className={BODY_CELL}>
                  <CenteredRightNumber value={row.stockCount} />
                </td>
                <td className={`${BODY_CELL} text-center`}>
                  <MarketValueCell won={row.marketValue} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type StockSortKey = 'stockCode' | 'stockName' | 'sectorName' | 'totalMarketValue'

function StockTable({ sectors, emptyMessage }: { sectors: SectorRow[]; emptyMessage: string }) {
  const [query, setQuery] = useState('')
  const { sortKey, direction, toggle } = useSort<StockSortKey>('totalMarketValue', 'desc')
  const rows = useMemo(() => {
    const sign = direction === 'asc' ? 1 : -1
    return sectors
      .flatMap(sector => sector.stocks.map(stock => ({ ...stock, sectorName: sector.sectorName })))
      .sort((a, b) => {
        const diff =
          sortKey === 'totalMarketValue'
            ? a.totalMarketValue - b.totalMarketValue
            : sortKey === 'stockCode'
              ? a.stockCode.localeCompare(b.stockCode)
              : compareName(a[sortKey], b[sortKey])
        return diff === 0 ? a.stockCode.localeCompare(b.stockCode) : sign * diff
      })
  }, [sectors, sortKey, direction])
  const header = (key: StockSortKey, label: string) => (
    <SortableHeader label={label} active={sortKey === key} direction={direction} onClick={() => toggle(key)} />
  )
  const trimmed = query.trim()
  const visibleRows = trimmed
    ? rows.filter(row => row.stockName.includes(trimmed) || row.stockCode.includes(trimmed) || row.sectorName.includes(trimmed))
    : rows
  return (
    <div className="flex min-h-0 flex-1 flex-col text-white">
      <SearchBar
        query={query}
        onChange={setQuery}
        placeholder="종목명·코드·업종 검색"
        ariaLabel="종목 검색"
        countLabel={`${toCount(visibleRows.length)}/${toCount(rows.length)}종목`}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className={TABLE_CLASS}>
          <thead>
            <tr>
              {header('stockCode', '종목코드')}
              {header('stockName', '종목명')}
              {header('sectorName', '업종')}
              {header('totalMarketValue', '시가총액')}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && <EmptyRow colSpan={4} message={rows.length === 0 ? emptyMessage : '검색 결과가 없습니다.'} />}
            {visibleRows.map(row => (
              <tr key={row.stockCode}>
                <td className={`${BODY_CELL} text-center text-gray-400`}>{row.stockCode}</td>
                <td className={BODY_CELL}>
                  <CenteredLeft>{row.stockName}</CenteredLeft>
                </td>
                <td className={BODY_CELL}>
                  <CenteredLeft>{row.sectorName}</CenteredLeft>
                </td>
                <td className={`${BODY_CELL} text-center`}>
                  <MarketValueCell won={row.totalMarketValue} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
