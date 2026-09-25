import type { MouseEvent, ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useIsLoggedIn } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'
import { FONT_NAV_TAB } from '@/components/FontStyle'
import type { MarketQuery } from '@/types/api'
import { marketRoute } from '@/utils/marketRoute'

const BASE_LINKS = [
  { to: '/summary', label: '요약' },
  { to: '/map/allstock', label: '지도' },
  { to: '/sector/allstock', label: '섹터' },
]
// 비로그인에게도 항상 보인다 — 로그인 여부와 무관하게 메뉴는 노출하고, 클릭 시점에만 로그인 팝업으로
// 막는다(가입/로그인 전환 지시서 결정).
const CUSTOM_LINK = { to: '/admin/sector', label: '커스텀' }

// "지도"/"섹터" 탭 위에 마우스를 올리면 뜨는 마켓 목록 — 두 탭 다 같은 목록이고 이동할 경로(basePath)만
// 다르다.
const MARKET_LIST_ITEMS: { label: string; market: MarketQuery }[] = [
  { label: 'ALL STOCK', market: 'ALL_STOCK' },
  { label: 'KOSPI', market: 'KOSPI' },
  { label: 'KOSDAQ', market: 'KOSDAQ' },
]

// 글자가 안 잘리도록 가장 긴 라벨("ALL STOCK") 기준으로 폭이 자동으로 늘어난다(w-max).
function MarketDropdownItems({ basePath }: { basePath: '/map' | '/sector' }) {
  return (
    <>
      {MARKET_LIST_ITEMS.map(({ label, market }) => (
        <Link
          key={label}
          to={marketRoute(basePath, market)}
          className="px-3 py-1 text-left text-lg font-normal whitespace-nowrap text-white hover:bg-gray-800"
        >
          {label}
        </Link>
      ))}
    </>
  )
}

// "커스텀" 탭 위에 마우스를 올리면 뜨는 목록 — 종목/카테고리 관리 전환(예전엔 좌측 사이드바).
// 카테고리가 기본 모드(CustomManagePage 참고)라 목록도 카테고리를 먼저 보여준다.
const CUSTOM_MODE_LIST_ITEMS: { label: string; mode: 'stock' | 'category' }[] = [
  { label: '카테고리', mode: 'category' },
  { label: '종목', mode: 'stock' },
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
      <Link to={to} className={`${FONT_NAV_TAB} whitespace-nowrap ${active ? 'text-[var(--accent)]' : 'text-gray-400 group-hover:text-white'}`}>
        {label}
      </Link>
      <div className="absolute left-0 top-full z-30 hidden w-max flex-col bg-zinc-900 py-1 shadow-lg group-hover:flex">{children}</div>
    </div>
  )
}

// 탭 메뉴(왼쪽) + 페이지별 옵션 버튼(오른쪽)을 한 줄에 같이 보여주는 바.
export default function SubNavBar({ actions }: Props) {
  const location = useLocation()
  const isLoggedIn = useIsLoggedIn()
  const { requireLogin } = useLoginGate()
  const links = [...BASE_LINKS, CUSTOM_LINK]

  const linkClassName = (to: string) =>
    `${FONT_NAV_TAB} whitespace-nowrap ${location.pathname === to ? 'text-[var(--accent)]' : 'text-gray-400 hover:text-white'}`

  const isMarketTab = (to: string) => to === '/map/allstock' || to === '/sector/allstock'
  const isMarketTabActive = (to: string) =>
    to === '/map/allstock' ? location.pathname.startsWith('/map/') : to === '/sector/allstock' ? location.pathname.startsWith('/sector/') : false
  const isCustomTabActive = location.pathname === '/admin/sector' || location.pathname === '/admin/stock'

  // 비로그인이 커스텀 메뉴(탭 자체 또는 카테고리/종목 하위 목록)를 클릭하면 실제 이동 대신 로그인
  // 팝업을 띄운다 — 목적지 경로를 returnTo로 넘겨서 로그인 성공 후 그 화면으로 바로 돌아온다.
  const guardCustomNavigate = (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (isLoggedIn) return
    e.preventDefault()
    requireLogin(to)
  }

  return (
    <div className="flex h-8 shrink-0 items-center justify-between gap-3 bg-zinc-900 px-3 text-xs shadow-lg">
      <div className="flex h-8 items-center gap-3">
        {links.map(link =>
          isMarketTab(link.to) ? (
            // 클릭하면 기본값(ALL STOCK)으로 이동하고, 마우스를 올리면 목록에서 마켓을 골라 들어갈 수 있다.
            <TabWithDropdown
              key={link.to}
              to={link.to}
              label={link.label}
              active={isMarketTabActive(link.to)}
            >
              <MarketDropdownItems basePath={link.to.startsWith('/map/') ? '/map' : '/sector'} />
            </TabWithDropdown>
          ) : link.to === '/admin/sector' ? (
            <div key={link.to} className="group relative flex h-8 items-center">
              <Link
                to={link.to}
                onClick={e => guardCustomNavigate(e, link.to)}
                className={`${FONT_NAV_TAB} whitespace-nowrap ${isCustomTabActive ? 'text-[var(--accent)]' : 'text-gray-400 group-hover:text-white'}`}
              >
                {link.label}
              </Link>
              <div className="absolute left-0 top-full z-30 hidden w-max flex-col bg-zinc-900 py-1 shadow-lg group-hover:flex">
                {CUSTOM_MODE_LIST_ITEMS.map(({ label, mode }) => {
                  const to = mode === 'stock' ? '/admin/stock' : '/admin/sector'
                  return (
                    <Link
                      key={label}
                      to={to}
                      onClick={e => guardCustomNavigate(e, to)}
                      className="px-3 py-1 text-left text-lg font-normal whitespace-nowrap text-white hover:bg-gray-800"
                    >
                      {label}
                    </Link>
                  )
                })}
              </div>
            </div>
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
