import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

const LINKS = [
  { to: '/market-map', label: '마켓맵' },
  { to: '/market-summary', label: '시장요약' },
]

interface Props {
  center?: ReactNode
  actions?: ReactNode
}

export default function NavBar({ center, actions }: Props) {
  const location = useLocation()

  const linkClassName = (to: string) =>
    `whitespace-nowrap text-[1.1667rem] ${location.pathname === to ? 'font-bold text-indigo-700' : 'text-black hover:text-gray-600'}`

  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-4 bg-white px-4 shadow-lg">
      <div className="flex items-center gap-4">
        {LINKS.map(link => (
          <Link key={link.to} to={link.to} className={linkClassName(link.to)}>
            {link.label}
          </Link>
        ))}
      </div>
      {center && <div className="flex flex-1 items-center justify-center gap-2">{center}</div>}
      <div className={`flex items-center gap-2 ${center ? '' : 'ml-auto'}`}>
        {actions}
        <Link to="/admin" className="nes-btn text-white">
          IP관리
        </Link>
      </div>
    </header>
  )
}
