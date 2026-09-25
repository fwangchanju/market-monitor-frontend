import NavBar from '@/components/NavBar'
import SubNavBar from '@/components/SubNavBar'

// 가입/로그인 전환 지시서 4: 관심종목 폐지와 함께 /summary를 내비게이션만 있는 빈 껍데기로 바꾼다.
// 아래 본문 섹션은 전부 JSX 주석으로 걷어냈고, 그에 딸려 있던 데이터 조회 훅(useMarketSummary)·
// 설정/공유/캡처 상태·NavBarPageActions도 더는 아무것도 호출하지 않도록 같이 지웠다 — 빈 화면에서
// 요약·관심종목 API 요청이 일어나지 않아야 한다.
//
// 걷어낸 섹션: MarketOverviewSection, IndexContributionSection, InvestorTradingSection,
// ProgramTradingSection, IntradayTopSection, ShortSellingHistorySection, ProgramTradingHistorySection.
// 새 구조로 다시 만드는 것은 이번 작업 범위가 아니다.
export default function MarketSummaryPage() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <SubNavBar />
      <div className="flex min-h-0 flex-1 bg-black">
        {/*
        <div className="mx-auto max-w-[1400px]">
          <div className="mt-4 grid grid-cols-1 gap-4">
            <MarketOverviewSection />
            <IndexContributionSection />
            <InvestorTradingSection />
            <ProgramTradingSection />
            <IntradayTopSection />
            <ShortSellingHistorySection />
            <ProgramTradingHistorySection />
          </div>
        </div>
        */}
      </div>
    </div>
  )
}
