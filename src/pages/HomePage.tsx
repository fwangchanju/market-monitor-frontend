import { Link } from 'react-router-dom'
import NavBar from '@/components/NavBar'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="mx-auto flex max-w-[400px] flex-col gap-4 px-6 py-12">
        <Link to="/market-summary" className="nes-btn is-primary text-center">
          시장 요약
        </Link>
        <Link to="/market-map" className="nes-btn is-primary text-center">
          마켓맵
        </Link>
      </div>
    </div>
  )
}
