import { useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import MarketSummaryPage from './pages/MarketSummaryPage'
import MapPage from './pages/MapPage'
import GroupPage from './pages/GroupPage'
import CustomPage from './pages/CustomPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import ProfilePage from './pages/ProfilePage'
import LoginGateProvider from './components/LoginGateProvider'
import AppDialogHost from './components/AppDialogHost'

// 페이지 전체와 document.body로 포털 렌더링한 메뉴/팝업에 같은 숫자 폭 규칙을 적용한다.
// 공통 스냅샷 날짜·시간도 FONT_BAR_TIME에서 동일한 숫자 폭을 명시한다.
function PageNumberStyle() {
  const { pathname } = useLocation()
  const useTabularNumbers = pathname === '/group' || pathname.startsWith('/group/')
    || pathname === '/custom' || pathname.startsWith('/custom/')

  useLayoutEffect(() => {
    document.body.classList.toggle('tabular-nums', useTabularNumbers)
    return () => document.body.classList.remove('tabular-nums')
  }, [useTabularNumbers])

  return null
}

function LegacyGroupRedirect() {
  const { pathname, search, hash } = useLocation()
  const groupPath = pathname.replace(/^\/(?:sector|industry)(?=\/|$)/, '/group')
  return <Navigate to={`${groupPath}${search}${hash}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AppDialogHost />
      <LoginGateProvider>
        <PageNumberStyle />
        <Routes>
          <Route path="/" element={<Navigate to="/map/allstock" replace />} />
          <Route path="/home" element={<MarketSummaryPage />} />
          <Route path="/summary" element={<Navigate to="/home" replace />} />
          <Route path="/map" element={<Navigate to="/map/allstock" replace />} />
          <Route path="/map/kospi" element={<MapPage />} />
          <Route path="/map/kosdaq" element={<MapPage />} />
          <Route path="/map/allstock" element={<MapPage />} />
          <Route path="/group" element={<Navigate to="/group/allstock" replace />} />
          <Route path="/group/kospi" element={<GroupPage />} />
          <Route path="/group/kosdaq" element={<GroupPage />} />
          <Route path="/group/allstock" element={<GroupPage />} />
          <Route path="/sector" element={<LegacyGroupRedirect />} />
          <Route path="/sector/*" element={<LegacyGroupRedirect />} />
          <Route path="/industry" element={<LegacyGroupRedirect />} />
          <Route path="/industry/*" element={<LegacyGroupRedirect />} />
          {/* 커스텀 관리의 주소는 /custom 아래에서 업종·종목 화면으로 나뉜다. */}
          <Route path="/custom" element={<Navigate to="/custom/industry" replace />} />
          <Route path="/custom/industry" element={<CustomPage />} />
          <Route path="/custom/category" element={<Navigate to="/custom/industry" replace />} />
          <Route path="/custom/stock" element={<CustomPage />} />
          {/* 기존 링크와 로그인 returnTo 호환을 위해 이전 주소는 새 주소로 보낸다. */}
          <Route path="/admin/sector" element={<Navigate to="/custom/industry" replace />} />
          <Route path="/admin/stock" element={<Navigate to="/custom/stock" replace />} />
          {/* Google OAuth 동의 화면에 등록하는 공개 페이지 — 로그인 여부와 무관하게 누구나 볼 수
              있어야 하고, 세션/시세 등 데이터 API를 호출하지 않는 순수 정적 페이지다. */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/map/allstock" replace />} />
        </Routes>
      </LoginGateProvider>
    </BrowserRouter>
  )
}
