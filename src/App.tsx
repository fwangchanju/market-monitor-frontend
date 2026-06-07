import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PrototypeNesPage from './pages/PrototypeNesPage'
import IntradayRankingPage from './pages/IntradayRankingPage'
import ProgramTradingPage from './pages/ProgramTradingPage'
import IndexContributionPage from './pages/IndexContributionPage'
import StockDetailPage from './pages/StockDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PrototypeNesPage />} />
        <Route path="/intraday-rankings" element={<IntradayRankingPage />} />
        <Route path="/program-trading" element={<ProgramTradingPage />} />
        <Route path="/index-contribution" element={<IndexContributionPage />} />
        <Route path="/stocks/:stockCode" element={<StockDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
