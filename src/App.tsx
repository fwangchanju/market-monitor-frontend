import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MarketSummaryPage from './pages/MarketSummaryPage'
import MarketSummaryCapturePage from './pages/MarketSummaryCapturePage'
import MarketMapPage from './pages/MarketMapPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/market-map" replace />} />
        <Route path="/market-summary" element={<MarketSummaryPage />} />
        <Route path="/market-summary/capture" element={<MarketSummaryCapturePage />} />
        <Route path="/market-map" element={<MarketMapPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/market-map" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
