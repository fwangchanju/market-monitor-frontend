import type { MouseEvent, ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useIsLoggedIn } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'
import { FONT_NAV_TAB } from '@/components/FontStyle'

const BASE_LINKS = [
  { to: '/home', label: 'HOME' },
  { to: '/map/allstock', label: 'MAP' },
  { to: '/group/allstock', label: 'GROUP' },
]
// 비로그인에게도 항상 보인다 — 로그인 여부와 무관하게 메뉴는 노출하고, 클릭 시점에만 로그인 팝업으로
// 막는다(가입/로그인 전환 지시서 결정).
const CUSTOM_LINK = { to: '/custom/category', label: 'CUSTOM' }

interface Props {
  // 페이지별 옵션 버튼 — 재사용되지 않는 페이지 전용 UI라 각 페이지가 인라인으로 만들어 넘긴다.
  actions?: ReactNode
}

// 탭 메뉴(왼쪽) + 페이지별 옵션 버튼(오른쪽)을 한 줄에 같이 보여주는 바.
export default function SubNavBar({ actions }: Props) {
  const location = useLocation()
  const isLoggedIn = useIsLoggedIn()
  const { requireLogin } = useLoginGate()
  const links = [...BASE_LINKS, CUSTOM_LINK]

  const isLinkActive = (to: string) => {
    if (to === '/map/allstock') return location.pathname.startsWith('/map/')
    if (to === '/group/allstock') return location.pathname.startsWith('/group/')
    if (to === '/custom/category') return location.pathname.startsWith('/custom')
    return location.pathname === to
  }
  const linkClassName = (to: string) =>
    `${FONT_NAV_TAB} whitespace-nowrap ${isLinkActive(to) ? 'text-[var(--accent)]' : 'text-gray-400 hover:text-white'}`

  // 비로그인이 커스텀 메뉴(탭 자체 또는 섹터/종목 하위 목록)를 클릭하면 실제 이동 대신 로그인
  // 팝업을 띄운다 — 목적지 경로를 returnTo로 넘겨서 로그인 성공 후 그 화면으로 바로 돌아온다.
  const guardCustomNavigate = (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (isLoggedIn) return
    e.preventDefault()
    requireLogin(to)
  }

  return (
    <div className="flex h-8 shrink-0 items-center justify-between gap-3 bg-zinc-900 px-3 text-xs shadow-lg">
      <div className="flex h-8 items-center gap-3">
        {links.map(link => (
          <Link
            key={link.to}
            to={link.to}
            onClick={link.to === '/custom/category' ? e => guardCustomNavigate(e, link.to) : undefined}
            className={linkClassName(link.to)}
          >
            {link.label}
          </Link>
        ))}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
