import { useLocation } from 'react-router-dom'
import { useSession, useLogout } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'

// 모든 페이지에서 항상 똑같이 고정되는 최상단 바 — 로그인 상태 표시와 로그인/로그아웃만 담당한다.
// 로그인 버튼은 SubNavBar 우측 "일괄변경"류 accent 버튼(nes-btn + var(--accent))과 같은 톤을 쓰고,
// 로그인한 사용자의 이메일·로그아웃 목록은 SubNavBar의 마켓/커스텀 탭 hover 목록과 동일한 패턴
// (그룹 hover로 펼치는 bg-zinc-900 목록)을 그대로 재사용한다 — 새 팝업 스타일을 만들지 않는다.
// 등락률 전용 색(--stock-up/--stock-down/--negative, 즉 red/blue 계열)은 쓰지 않는다.
export default function NavBar() {
  const localAutoLogin = import.meta.env.DEV && import.meta.env.VITE_LOCAL_AUTO_LOGIN === '1'
  const { pathname } = useLocation()
  const { data: session, isLoading } = useSession()
  const { requireLogin } = useLoginGate()
  const logout = useLogout()

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-end bg-zinc-900 px-4 shadow-lg">
      {localAutoLogin ? (
        session?.authenticated ? (
          <span className="max-w-[12rem] truncate text-sm text-gray-300">
            {session.email || `사용자 ${session.userId}`}
          </span>
        ) : null
      ) : !isLoading &&
        (session?.authenticated ? (
          <div className="group relative flex h-12 items-center">
            <span className="max-w-[12rem] truncate text-sm text-gray-300 group-hover:text-white">
              {session.email}
            </span>
            <div className="absolute right-0 top-full z-30 hidden w-max flex-col bg-zinc-900 py-1 shadow-lg group-hover:flex">
              <button
                type="button"
                onClick={() => logout.mutate()}
                className="px-3 py-1 text-left text-sm whitespace-nowrap text-white hover:bg-gray-800"
              >
                로그아웃
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => requireLogin(pathname)}
            className="nes-btn border-[var(--accent)] bg-transparent px-3 py-1 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
          >
            로그인
          </button>
        ))}
    </header>
  )
}
