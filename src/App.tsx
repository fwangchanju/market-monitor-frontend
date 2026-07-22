import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MarketSummaryPage from './pages/MarketSummaryPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MarketSummaryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
