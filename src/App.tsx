import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MarketSummaryPage from './pages/MarketSummaryPage'
import MarketMapCustomPage from './pages/MarketMapCustomPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/market-map-custom" replace />} />
        <Route path="/market-summary" element={<MarketSummaryPage />} />
        <Route path="/market-map" element={<Navigate to="/market-map-custom" replace />} />
        <Route path="/market-map-custom" element={<MarketMapCustomPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/market-map-custom" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
