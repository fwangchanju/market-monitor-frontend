import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Prototype98Page from './pages/Prototype98Page'
import PrototypeNesPage from './pages/PrototypeNesPage'
import IntradayRankingPage from './pages/IntradayRankingPage'
import ProgramTradingPage from './pages/ProgramTradingPage'
import IndexContributionPage from './pages/IndexContributionPage'
import StockDetailPage from './pages/StockDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Prototype98Page />} />
        <Route path="/c" element={<PrototypeNesPage />} />
        <Route path="/intraday-rankings" element={<IntradayRankingPage />} />
        <Route path="/program-trading" element={<ProgramTradingPage />} />
        <Route path="/index-contribution" element={<IndexContributionPage />} />
        <Route path="/stocks/:stockCode" element={<StockDetailPage />} />
      </Routes>
    </BrowserRouter>
  )
}
