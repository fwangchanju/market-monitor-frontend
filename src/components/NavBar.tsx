import { Link, useLocation } from 'react-router-dom'

const LINKS = [
  { to: '/market-map', label: '마켓맵' },
  { to: '/market-summary', label: '시장 요약' },
]

const ADMIN_LINK = { to: '/admin', label: '허용IP관리' }

export default function NavBar() {
  const location = useLocation()

  const linkClassName = (to: string) =>
    `text-[1.75rem] ${location.pathname === to ? 'font-bold text-indigo-700' : 'text-black hover:text-gray-600'}`

  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 bg-white px-6 py-6 shadow-lg">
      {LINKS.map(link => (
        <Link key={link.to} to={link.to} className={linkClassName(link.to)}>
          {link.label}
        </Link>
      ))}
      <Link to={ADMIN_LINK.to} className={`ml-auto ${linkClassName(ADMIN_LINK.to)}`}>
        {ADMIN_LINK.label}
      </Link>
    </header>
  )
}
