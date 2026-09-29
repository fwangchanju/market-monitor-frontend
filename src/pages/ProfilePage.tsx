import { useNavigate } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import { useLoginGate } from '@/hooks/useLoginGate'
import { useLogout, useSession } from '@/hooks/useSession'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { data: session, isLoading, isError } = useSession()
  const { requireLogin } = useLoginGate()
  const logout = useLogout()

  const handleLogout = async () => {
    try {
      await logout.mutateAsync()
      navigate('/map/allstock', { replace: true })
    } catch {
      // 요청 실패는 아래 계정 카드에서 안내한다.
    }
  }

  return (
    <div className="min-h-screen text-white">
      <NavBar />
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold">프로필</h1>
        <section className="mt-6 rounded-lg border border-gray-700 bg-zinc-800 p-6">
          {isLoading ? (
            <p className="text-sm text-gray-400">계정 정보를 불러오는 중입니다.</p>
          ) : isError ? (
            <p className="text-sm text-gray-300">계정 정보를 불러오지 못했습니다. 페이지를 새로고침해 주세요.</p>
          ) : session?.authenticated ? (
            <>
              <h2 className="text-lg font-semibold">계정 정보</h2>
              <div className="mt-6 border-t border-gray-700 pt-5">
                <p className="text-sm text-gray-400">이메일</p>
                <p className="mt-2 break-all text-base">{session.email || '등록된 이메일 없음'}</p>
              </div>
              <div className="mt-8 border-t border-gray-700 pt-6">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logout.isPending}
                  className="rounded border border-gray-500 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-50"
                >
                  {logout.isPending ? '로그아웃 중...' : '로그아웃'}
                </button>
                {logout.isError && <p role="alert" className="mt-3 text-sm text-red-300">로그아웃하지 못했습니다. 다시 시도해 주세요.</p>}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-300">계정 정보를 보려면 로그인해 주세요.</p>
              <button
                type="button"
                onClick={() => requireLogin('/profile')}
                className="nes-btn mt-5 border-[var(--accent)] bg-transparent px-4 py-2 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
              >
                로그인
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
