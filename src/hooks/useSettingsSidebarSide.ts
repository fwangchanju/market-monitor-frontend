import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'

// 설정창을 화면 왼쪽에 붙일지 — 지도·그룹 페이지가 같은 값을 공유하는 이 브라우저만의 화면 취향이다(저장 키 하나).
export function useSettingsSidebarSide() {
  const [isOnLeft, setIsOnLeft] = useLocalPersistedState('settings-sidebar-on-left', false)
  return { isOnLeft, toggleSide: () => setIsOnLeft(prev => !prev) }
}
