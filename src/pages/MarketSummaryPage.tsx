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
    <div className="flex h-screen flex-col overflow-hidden bg-black">
      <NavBar />
      <SubNavBar />
      {/* 지도/그룹/커스텀 페이지와 같은 본문 틀 — 나중에 내용을 채울 때 이 구조를 그대로 쓴다.
          바깥 박스가 -mt-[10.5px]로 SubNavBar의 짙은 회색 하단에 맞춰 올라가 있으므로, 안쪽 콘솔 줄은
          mt/mb 5.25px로 위치를 맞추고(이 박스 안에 있어야 overflow에 잘리지 않는다), 설정창
          (SettingsSidebar)은 이 박스의 맨 오른쪽 자식으로 넣으면 같은 높이에 붙는다. */}
      <div className="relative z-10 -mt-[10.5px] flex min-h-0 flex-1 overflow-hidden bg-black text-white">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative mt-[5.25px] mb-[5.25px] flex h-7 w-full shrink-0 items-center justify-between bg-black/70 pl-2 pr-3 text-sm font-bold text-white">
            {/* 콘솔 줄: 드롭다운 → 스냅샷 날짜/시간 순으로 왼쪽에 배치 */}
          </div>
          <div className="flex min-h-0 flex-1">
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
      </div>
    </div>
  )
}
