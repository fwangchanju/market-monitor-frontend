import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession, useLogout, useSessionKeepAlive, useLocalDevLogin } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'
import ProfileAvatar from '@/components/ProfileAvatar'
import MarketryLogo from '@/components/MarketryLogo'
import { devSignup } from '@/api/auth'
import { settleSessionRefresh } from '@/api/client'
import { cancelPendingPreferenceSave } from '@/hooks/useCustomPreferences'
import { isLocalSignupEnabled } from '@/utils/localDevLogin'

// 모든 페이지에서 항상 똑같이 고정되는 최상단 바 — 홈 이동과 로그인 상태/프로필 메뉴를 담당한다.
// 로그인 버튼은 NavSubBar 우측 "일괄변경"류 accent 버튼(nes-btn + var(--accent))과 같은 톤을 쓰고,
// 로그인한 사용자는 우측 아바타에서 계정 메뉴를 연다.
// 등락률 전용 색(--stock-up/--stock-down/--negative, 즉 red/blue 계열)은 쓰지 않는다.
// hideAccount가 true면 오른쪽의 로그인 버튼/프로필 아이콘을 숨기고 로고만 보여준다(비로그인이 프로필 페이지에 들어왔을 때).
export default function NavBar({ hideAccount = false }: { hideAccount?: boolean }) {
  const { data: session, isLoading } = useSession()
  const { pathname, search, hash } = useLocation()
  const { requireLogin } = useLoginGate()
  const logout = useLogout()
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isDevSignupPending, setIsDevSignupPending] = useState(false)
  const [devSignupError, setDevSignupError] = useState<string | null>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  useLocalDevLogin()
  // 세션 확인이 끝났고 로그인하지 않은 상태 — 확인 중(isLoading)에는 깜빡임 없이 프로필 아이콘을 유지한다.
  const isLoggedOut = !isLoading && !session?.authenticated
  // dev-login도 구글 로그인과 같은 15분짜리 접근 토큰을 발급하므로, localAutoLogin 여부와 무관하게
  // 로그인 상태면 동일하게 선제 갱신한다.
  useSessionKeepAlive((session?.authenticated ?? false) && !isDevSignupPending)

  const handleDevSignup = async () => {
    setIsDevSignupPending(true)
    setDevSignupError(null)
    cancelPendingPreferenceSave()
    try {
      await settleSessionRefresh()
      await devSignup()
      // 현재 화면을 다시 열어 이전 회원의 캐시를 비우고, 비회원 확인 모드만 해제한다.
      const currentUrl = new URL(window.location.href)
      currentUrl.searchParams.set('guest', '0')
      window.location.assign(currentUrl.href)
    } catch {
      setDevSignupError('생성 실패: 백엔드 local 프로필을 확인하세요.')
      setIsDevSignupPending(false)
    }
  }

  useEffect(() => {
    if (!isProfileMenuOpen) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setIsProfileMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false)
        profileButtonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isProfileMenuOpen])

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-zinc-900 px-4">
      <Link
        to="/"
        aria-label="홈으로 이동: 지도 전체 종목"
        className="flex h-[60px] shrink-0 items-center"
      >
        <MarketryLogo className="h-[40.9px] w-auto max-w-[18rem]" />
      </Link>
      <div className="flex items-center gap-3">
      {!hideAccount && isLocalSignupEnabled() && (
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleDevSignup}
            disabled={isLoading || isDevSignupPending}
            className="nes-btn border-gray-600 bg-black px-3 py-1 text-xs text-white hover:bg-zinc-700 disabled:opacity-50"
            title="로컬 DB에 새 USER 계정을 만들고 내 분류 STOCK 화면으로 이동합니다."
          >
            {isDevSignupPending ? '테스트 회원 생성 중…' : '새 테스트 회원'}
          </button>
          {devSignupError && <span role="alert" className="text-xs text-[var(--accent)]">{devSignupError}</span>}
        </div>
      )}
      {hideAccount ? null : isLoggedOut ? (
        // 비로그인은 프로필 아이콘 대신 "로그인" 버튼을 바로 보여줘서 로그인/비로그인 상태가 한눈에 구분된다.
        <button
          type="button"
          onClick={() => requireLogin(`${pathname}${search}${hash}`, { hideMessage: true })}
          className="nes-btn border-[var(--accent)] bg-transparent px-3 py-1 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
        >
          로그인
        </button>
      ) : (
      <div ref={profileMenuRef} className="relative flex h-16 items-center">
        <button
          ref={profileButtonRef}
          type="button"
          aria-label={isProfileMenuOpen ? '계정 메뉴 닫기' : '계정 메뉴 열기'}
          aria-expanded={isProfileMenuOpen}
          onClick={() => setIsProfileMenuOpen(open => !open)}
          className="relative -top-[2.5px] mr-0.5 size-[38px] overflow-hidden rounded-[12%] ring-2 ring-transparent hover:ring-zinc-400 focus-visible:outline-none focus-visible:ring-[var(--accent)]"
        >
          <ProfileAvatar className="size-full object-cover" />
        </button>
        {isProfileMenuOpen && (
          <div className="absolute right-0 top-full z-30 w-64 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-white shadow-xl">
            {isLoading ? (
              <p className="px-4 py-3 text-sm text-zinc-400">계정 확인 중...</p>
            ) : session?.authenticated ? (
              <>
                <div className="flex items-center gap-3 border-b border-zinc-700 px-4 py-3 text-sm">
                  <ProfileAvatar className="size-10 shrink-0 object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{session.nickname || '내 계정'}</p>
                    <p className="mt-1 truncate text-zinc-400">{session.email || `사용자 ${session.userId}`}</p>
                  </div>
                </div>
                <Link to="/profile" onClick={() => setIsProfileMenuOpen(false)} className="block px-4 py-3 text-sm hover:bg-zinc-700 focus:bg-zinc-700">
                  프로필
                </Link>
                <div className="mt-1 border-t border-zinc-700 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false)
                      logout.mutate()
                    }}
                    disabled={logout.isPending}
                    className="block w-full px-4 py-3 text-left text-sm hover:bg-zinc-700 focus:bg-zinc-700 disabled:opacity-50"
                  >
                    로그아웃
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
      )}
      </div>
    </header>
  )
}
