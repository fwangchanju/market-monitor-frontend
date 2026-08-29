import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useIsAdmin } from '@/hooks/useAccess'

const BASE_LINKS = [
  { to: '/market-summary', label: '요약' },
  { to: '/market-map', label: '지도' },
  { to: '/category-change-rate', label: '섹터' },
]
const ADMIN_LINK = { to: '/admin/market-map', label: '커스텀' }

// "지도" 탭 위에 마우스를 올리면 뜨는 마켓 목록 — market이 없으면(All Stocks) 아직 지원 안 해서 비활성.
const MARKET_LIST_ITEMS: { label: string; market?: 'KOSPI' | 'KOSDAQ' }[] = [
  { label: 'KOSPI', market: 'KOSPI' },
  { label: 'KOSDAQ', market: 'KOSDAQ' },
  { label: 'All Stocks' },
]

// "커스텀" 탭 위에 마우스를 올리면 뜨는 목록 — 어드민 종목/카테고리 관리 전환(예전엔 좌측 사이드바).
const ADMIN_MODE_LIST_ITEMS: { label: string; mode: 'stock' | 'category' }[] = [
  { label: '종목', mode: 'stock' },
  { label: '카테고리', mode: 'category' },
]

interface Props {
  // 페이지별 옵션 버튼 — 재사용되지 않는 페이지 전용 UI라 각 페이지가 인라인으로 만들어 넘긴다.
  actions?: ReactNode
}

// 탭 메뉴 중 마우스를 올리면 아래로 목록이 펼쳐지는 탭 — h-8(바 전체 높이)을 그대로 채워야
// 목록의 top-full이 탭 텍스트의 줄높이가 아니라 바의 실제 하단선에 딱 맞게 시작한다. 앞으로 SubNavBar에
// 새 hover 목록을 추가할 때도 이 컴포넌트를 재사용하면 항상 같은 높이에서 시작한다.
function TabWithDropdown({ to, label, active, children }: { to: string; label: string; active: boolean; children: ReactNode }) {
  return (
    <div className="group relative flex h-8 items-center">
      <Link to={to} className={`whitespace-nowrap text-xl font-bold ${active ? 'text-indigo-700' : 'text-gray-600 group-hover:text-black'}`}>
        {label}
      </Link>
      <div className="absolute left-0 top-full z-30 hidden w-max flex-col bg-black py-1 shadow-lg group-hover:flex">{children}</div>
    </div>
  )
}

// 탭 메뉴(왼쪽) + 페이지별 옵션 버튼(오른쪽)을 한 줄에 같이 보여주는 바.
export default function SubNavBar({ actions }: Props) {
  const location = useLocation()
  const isAdmin = useIsAdmin()
  const links = isAdmin ? [...BASE_LINKS, ADMIN_LINK] : BASE_LINKS

  const linkClassName = (to: string) =>
    `whitespace-nowrap text-xl font-bold ${location.pathname === to ? 'text-indigo-700' : 'text-gray-600 hover:text-black'}`

  return (
    <div className="flex h-8 shrink-0 items-center justify-between gap-3 bg-white px-3 text-xs shadow-lg">
      <div className="flex h-8 items-center gap-3">
        {links.map(link =>
          link.to === '/market-map' ? (
            <TabWithDropdown key={link.to} to={link.to} label={link.label} active={location.pathname === link.to}>
              {/* 클릭하면 그냥 지도(기본값 KOSPI)로 이동하고, 마켓을 올려두면 여기서 골라 바로 그 마켓
                  지도로 들어갈 수 있다. 글자가 안 잘리도록 가장 긴 라벨("All Stocks") 기준으로
                  폭이 자동으로 늘어난다(w-max). */}
              {MARKET_LIST_ITEMS.map(({ label, market }) =>
                market ? (
                  <Link
                    key={label}
                    to={`/market-map?market=${market}`}
                    className="px-3 py-1 text-left text-lg font-normal whitespace-nowrap text-white hover:bg-gray-800"
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    key={label}
                    className="cursor-not-allowed px-3 py-1 text-left text-lg font-normal whitespace-nowrap text-gray-500"
                  >
                    {label}
                  </span>
                ),
              )}
            </TabWithDropdown>
          ) : link.to === '/admin/market-map' ? (
            <TabWithDropdown key={link.to} to={link.to} label={link.label} active={location.pathname === link.to}>
              {ADMIN_MODE_LIST_ITEMS.map(({ label, mode }) => (
                <Link
                  key={label}
                  to={`/admin/market-map?mode=${mode}`}
                  className="px-3 py-1 text-left text-lg font-normal whitespace-nowrap text-white hover:bg-gray-800"
                >
                  {label}
                </Link>
              ))}
            </TabWithDropdown>
          ) : (
            <Link key={link.to} to={link.to} className={linkClassName(link.to)}>
              {link.label}
            </Link>
          ),
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
