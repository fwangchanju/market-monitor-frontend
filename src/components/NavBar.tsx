import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useIsAdmin } from '@/hooks/useAccess'

const BASE_LINKS = [
  { to: '/market-summary', label: '요약' },
  { to: '/market-map', label: '지도' },
]
const ADMIN_LINK = { to: '/admin/market-map', label: '개인 설정' }

interface Props {
  center?: ReactNode
  actions?: ReactNode
}

export default function NavBar({ center, actions }: Props) {
  const location = useLocation()
  const isAdmin = useIsAdmin()
  const links = isAdmin ? [...BASE_LINKS, ADMIN_LINK] : BASE_LINKS

  const linkClassName = (to: string) =>
    `whitespace-nowrap text-[1.1667rem] ${location.pathname === to ? 'font-bold text-indigo-700' : 'text-black hover:text-gray-600'}`

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-4 bg-white px-4 shadow-lg">
      <div className="flex items-center gap-4">
        {links.map(link => (
          <Link key={link.to} to={link.to} className={linkClassName(link.to)}>
            {link.label}
          </Link>
        ))}
      </div>
      {center && <div className="flex flex-1 items-center justify-center gap-2">{center}</div>}
      {actions && <div className={`flex items-center gap-2 ${center ? '' : 'ml-auto'}`}>{actions}</div>}
    </header>
  )
}
