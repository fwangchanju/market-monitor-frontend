import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MarketSummaryPage from './pages/MarketSummaryPage'
import MarketMapCustomPage from './pages/MarketMapCustomPage'
import AdminPage from './pages/AdminPage'
import MarketMapAdminPage from './pages/MarketMapAdminPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/market-map" replace />} />
        <Route path="/market-summary" element={<MarketSummaryPage />} />
        <Route path="/market-map" element={<MarketMapCustomPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/market-map" element={<MarketMapAdminPage />} />
        <Route path="*" element={<Navigate to="/market-map" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
