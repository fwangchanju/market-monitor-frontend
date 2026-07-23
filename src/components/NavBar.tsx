import { Link, useLocation } from 'react-router-dom'

const LINKS = [
  { to: '/', label: '홈' },
  { to: '/market-summary', label: '시장 요약' },
  { to: '/market-map', label: '마켓맵' },
]

export default function NavBar() {
  const location = useLocation()

  return (
    <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-gray-700 bg-[var(--surface)] px-6 py-3">
      {LINKS.map(link => (
        <Link
          key={link.to}
          to={link.to}
          className={`text-sm ${
            location.pathname === link.to ? 'font-bold text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </header>
  )
}
