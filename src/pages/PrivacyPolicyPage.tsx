// 개인정보처리방침 — Google OAuth 동의 화면에 등록하는 공개 페이지라 로그인 여부와 무관하게 누구나
// 볼 수 있어야 하고, 세션/시세 등 어떤 데이터 API도 호출하지 않아야 한다(NavBar는 useSession으로
// 세션 조회 API를 부르므로 여기서는 쓰지 않는다). 그래서 이 페이지는 다른 페이지의 훅을 전혀 쓰지
// 않는 순수 정적 컴포넌트다. 톤은 LoginModal(어두운 배경, var(--surface) 패널, 흰 제목 + 회색 본문,
// accent만 강조에 사용)을 그대로 따르고, 등락률 전용 색(red/blue 계열)은 쓰지 않는다.
//
// 문의 이메일은 아직 정해지지 않아 자리표시자로 비워둔다 — 운영자가 실제 이메일로 채워 넣어야 한다.
const CONTACT_EMAIL = ''

const EFFECTIVE_DATE = '2026-09-26'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 flex h-12 items-center bg-zinc-900 px-4 shadow-lg">
        <a href="/" className="text-sm font-bold text-white">
          Market Monitor
        </a>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="nes-container is-dark">
          <h1 className="text-2xl font-bold text-white">개인정보처리방침</h1>
          <p className="mt-2 text-sm text-gray-400">시행일: {EFFECTIVE_DATE}</p>

          <section className="mt-8">
            <h2 className="text-lg font-bold text-white">1. 서비스 개요</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Market Monitor(eolmae.duckdns.org)는 개인이 운영하는 시장 데이터 조회 서비스입니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold text-white">2. 수집하는 개인정보 항목</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed text-gray-400">
              <li>Google 로그인 시: Google 계정 식별자(sub), 발급자(issuer), 이메일 주소</li>
              <li>로그인한 사용자가 저장한 화면 설정, 섹터 분류, 스냅샷</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold text-white">3. 개인정보의 이용 목적</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              로그인과 사용자 식별, 사용자별 설정 저장을 위해서만 이용합니다. 광고·마케팅 목적으로
              이용하거나 제3자에게 제공하지 않습니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold text-white">4. 쿠키</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              로그인 상태 유지를 위한 인증 쿠키(HttpOnly)만 사용합니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold text-white">5. 보관 기간 및 파기</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              수집한 개인정보는 계정 삭제를 요청하기 전까지 보관합니다. 삭제를 요청하면 계정과 해당
              사용자의 데이터를 삭제합니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold text-white">6. 문의</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              문의: {CONTACT_EMAIL || '(운영자 이메일)'}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
