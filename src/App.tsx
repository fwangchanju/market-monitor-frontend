import { useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import MarketSummaryPage from './pages/MarketSummaryPage'
import MarketMapCustomPage from './pages/MarketMapCustomPage'
import CategoryChangeRatePage from './pages/CategoryChangeRatePage'
import CustomManagePage from './pages/CustomManagePage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import LoginGateProvider from './components/LoginGateProvider'

// 페이지 전체와 document.body로 포털 렌더링한 메뉴/팝업에 같은 숫자 폭 규칙을 적용한다.
// 공통 스냅샷 시간은 FONT_BAR_TIME의 normal-nums로 이 상속에서 제외한다.
function PageNumberStyle() {
  const { pathname } = useLocation()
  const useTabularNumbers = pathname === '/sector' || pathname.startsWith('/sector/')
    || pathname === '/category-change-rate' || pathname === '/admin' || pathname.startsWith('/admin/')

  useLayoutEffect(() => {
    document.body.classList.toggle('tabular-nums', useTabularNumbers)
    return () => document.body.classList.remove('tabular-nums')
  }, [useTabularNumbers])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <LoginGateProvider>
        <PageNumberStyle />
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
          {/* IP 관리 AdminPage(/admin)와 옛 /admin/market-map 캡처 호환 경로는 가입/로그인 전환과 함께
              제거했다 — 커스텀 섹터·종목 관리 화면(CustomManagePage)은 /admin/sector, /admin/stock을
              그대로 쓴다(로그인 사용자 전용, 비로그인은 로그인 팝업). */}
          <Route path="/admin/sector" element={<CustomManagePage />} />
          <Route path="/admin/stock" element={<CustomManagePage />} />
          {/* Google OAuth 동의 화면에 등록하는 공개 페이지 — 로그인 여부와 무관하게 누구나 볼 수
              있어야 하고, 세션/시세 등 데이터 API를 호출하지 않는 순수 정적 페이지다. */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="*" element={<Navigate to="/map/allstock" replace />} />
        </Routes>
      </LoginGateProvider>
    </BrowserRouter>
  )
}
