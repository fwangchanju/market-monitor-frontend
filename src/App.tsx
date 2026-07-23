import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import MarketSummaryPage from './pages/MarketSummaryPage'
import MarketMapPage from './pages/MarketMapPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/market-summary" element={<MarketSummaryPage />} />
        <Route path="/market-map" element={<MarketMapPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
