import { useEffect } from 'react'
import { googleLoginUrl } from '@/api/auth'

interface Props {
  // 로그인 성공 후 백엔드가 돌려보낼 프론트 경로("/"로 시작). 로그인 팝업을 연 지점(메뉴 클릭,
  // 커스텀 모드 토글, 커스텀 페이지 직접 진입)의 목적지를 그대로 넘긴다.
  returnTo: string
  onClose: () => void
}

// MarketMapShareModal과 동일한 팝업 톤(어두운 배경 오버레이 + var(--surface) 패널, nes-btn 버튼)을
// 그대로 재사용한다 — 새 시각 스타일을 만들지 않는다. 강조 버튼도 기존 accent 토큰(노랑)만 쓰고
// 등락률 전용인 red/blue 계열(--stock-up/--stock-down/--negative)은 쓰지 않는다.
export default function LoginModal({ returnTo, onClose }: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-[calc(100%-2rem)] max-w-sm border border-gray-700 bg-[var(--surface)] p-6"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-lg font-bold text-white">로그인이 필요합니다</p>
        <p className="mt-2 text-sm text-gray-400">
          커스텀 지도·섹터와 개인 설정은 로그인한 사용자만 이용할 수 있습니다. 로그인하면 보던 화면으로 돌아옵니다.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {/* 실제 페이지 이동(전체 새로고침)이어야 하므로 버튼 클릭 핸들러가 아니라 일반 링크로 연다 —
              XHR로 처리하면 쿠키를 세팅하는 리다이렉트 체인이 브라우저 주소창에서 진행되지 않는다. */}
          <a
            href={googleLoginUrl(returnTo)}
            className="nes-btn flex items-center justify-center gap-2 border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-bold text-black hover:bg-[var(--accent-hover)]"
          >
            Google로 로그인
          </a>
          <button
            type="button"
            onClick={onClose}
            className="nes-btn border-gray-600 bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            닫기
          </button>
        </div>
        <a href="/privacy" className="mt-4 block text-center text-xs text-gray-500 hover:text-gray-300">
          개인정보처리방침
        </a>
      </div>
    </div>
  )
}
