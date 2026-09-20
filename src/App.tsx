import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MarketSummaryPage from './pages/MarketSummaryPage'
import MarketMapCustomPage from './pages/MarketMapCustomPage'
import CategoryChangeRatePage from './pages/CategoryChangeRatePage'
import AdminPage from './pages/AdminPage'
import MarketMapAdminPage from './pages/MarketMapAdminPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/map/allstock" replace />} />
        <Route path="/summary" element={<MarketSummaryPage />} />
        <Route path="/map" element={<Navigate to="/map/allstock" replace />} />
        <Route path="/map/kospi" element={<MarketMapCustomPage />} />
        <Route path="/map/kosdaq" element={<MarketMapCustomPage />} />
        <Route path="/map/allstock" element={<MarketMapCustomPage />} />
        <Route path="/sector" element={<Navigate to="/sector/allstock" replace />} />
        <Route path="/sector/kospi" element={<CategoryChangeRatePage />} />
        <Route path="/sector/kosdaq" element={<CategoryChangeRatePage />} />
        <Route path="/sector/allstock" element={<CategoryChangeRatePage />} />
        {/* 이전 주소도 캡처 쿼리를 보존할 수 있도록 페이지를 직접 렌더링한다. 새 링크는 위 새 주소를 사용한다. */}
        <Route path="/market-summary" element={<Navigate to="/summary" replace />} />
        <Route path="/market-map" element={<MarketMapCustomPage />} />
        <Route path="/category-change-rate" element={<CategoryChangeRatePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/sector" element={<MarketMapAdminPage />} />
        <Route path="/admin/stock" element={<MarketMapAdminPage />} />
        <Route path="/admin/market-map" element={<MarketMapAdminPage />} />
        <Route path="*" element={<Navigate to="/map/allstock" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
