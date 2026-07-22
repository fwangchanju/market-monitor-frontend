import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MarketSummaryPage from './pages/MarketSummaryPage'
import IntradayRankingPage from './pages/IntradayRankingPage'
import ProgramTradingPage from './pages/ProgramTradingPage'
import IndexContributionPage from './pages/IndexContributionPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MarketSummaryPage />} />
        <Route path="/intraday-rankings" element={<IntradayRankingPage />} />
        <Route path="/program-trading" element={<ProgramTradingPage />} />
        <Route path="/index-contribution" element={<IndexContributionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
