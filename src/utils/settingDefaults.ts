// 지도 설정의 기본값 — 사용자가 값을 바꾸기 전(저장값이 없을 때)에 보이는 값을 한 곳에 모았다.
// 기본값을 바꾸려면 이 파일만 고치면 된다. 사용자가 값을 바꿔서 저장값이 생기면 그 값이 항상 기본값보다 우선한다
// (로그인 사용자는 서버 설정, 비로그인은 이 탭의 sessionStorage — usePageSetting 참고).
//
// 회원 기본값(MEMBER_DEFAULTS)이 기준이고, 비로그인 기본값(GUEST_DEFAULTS)은 그중 다른 항목만 GUEST_OVERRIDES에 적는다.
// 처음 가입한 사용자에게 줄 별도의 기본값(MARKETRY 버전)이 정해지면 MEMBER_DEFAULTS를 그에 맞게 바꾼다.
// 항목 이름 뒤의 번호는 지도 설정창의 항목 번호다.

export type DepthMetricDefault = 'weightedAvgChangeRate' | 'simpleAvgChangeRate'

export interface SettingDefaults {
  // 분류 체계 — true는 MARKETRY 분류다. 비로그인은 이 값과 상관없이 항상 거래소 분류(KRX)로 고정된다(useGlobalSettings).
  isCustom: boolean
  // 1-1 업종 표시 단계: 켜짐 여부와 단계(1=대분류, 2=중분류, 3=소분류)
  sectorLevelEnabled: boolean
  maxDepth: number
  // 1-2 표시 지표
  depthMetric: DepthMetricDefault
  // 1-3 표시 위치: 단계 범위(0=대분류, 1=중분류, 2=소분류)
  depthMetricMinIndex: number
  depthMetricMaxIndex: number
  // 1-4 강세 표시: 단계(0=대분류, 1=중분류, 2=소분류)와 개수
  topPickDepth: number
  topPickCount: number
  // 2-1 시가총액 범위: 'all'은 모든 구간, 'excludeDefaultTiers'는 기본 제외 구간(소형주)을 뺀다,
  // 'topTwoTiers'는 시가총액이 큰 두 구간(초대형주+대형주)만 보여준다
  tierRange: 'all' | 'excludeDefaultTiers' | 'topTwoTiers'
  // 2-2 / 2-3 등락 방향 필터('all' | 'rising' | 'falling')와 2-2의 업종 단계(0=대분류)
  sectorChangeFilter: 'all' | 'rising' | 'falling'
  sectorChangeDepth: number
  stockChangeFilter: 'all' | 'rising' | 'falling'
  // 2-4 제외 업종 변경 사용 여부
  sectorFilterEnabled: boolean
  // 3-1 박스 크기: 시가총액 반영 비율(0=동일 크기 ~ 100=시가총액 비례)
  boxSizeMarketCapRatio: number
  // 3-2 박스 내 표기: 0=끄기, 1=종목명, 2=등락률, 3=종목명+등락률
  stockLabelModeIndex: number
  // 3-3 텍스트 표시 기준: 전체 면적 대비 박스 면적 비율(%)
  boxLabelMinAreaPercent: number
  // 3-4 등락률 소수점: 0=정수, 1=1자리, 2=2자리
  decimalPlacesIndex: number
  // 3-5 종목 정보 팝업: true면 커서를 올릴 때, false면 우클릭으로 연다
  stockPopupOnHover: boolean
  // 4-1 강조 색상
  strongIndustryColor: string
  // 4-2 등락률 색상 범위 커스텀 사용 여부
  colorCustomOn: boolean
  // 섹터 랭킹/그룹 화면의 평균 방식(true=동일 가중)
  avgChangeRateUseSimple: boolean
  // 설정창: 핀 켜짐(고정 + 열린 채로 시작)
  sidebarPinned: boolean
}

export const MEMBER_DEFAULTS: SettingDefaults = {
  isCustom: true,
  sectorLevelEnabled: true,
  maxDepth: 2,
  depthMetric: 'simpleAvgChangeRate',
  depthMetricMinIndex: 0,
  depthMetricMaxIndex: 1,
  topPickDepth: 1,
  topPickCount: 2,
  tierRange: 'excludeDefaultTiers',
  sectorChangeFilter: 'all',
  sectorChangeDepth: 0,
  stockChangeFilter: 'all',
  sectorFilterEnabled: true,
  boxSizeMarketCapRatio: 50,
  stockLabelModeIndex: 3,
  boxLabelMinAreaPercent: 0.1,
  decimalPlacesIndex: 1,
  stockPopupOnHover: false,
  strongIndustryColor: '#4dd0e1',
  colorCustomOn: true,
  avgChangeRateUseSimple: true,
  sidebarPinned: true,
}

// 비로그인 기본값 — 회원 기본값과 다른 항목만 적는다. 설정을 바꿀 때 드라마틱하게 보이도록 큰 값으로 시작한다.
const GUEST_OVERRIDES: Partial<SettingDefaults> = {
  maxDepth: 1, // 1-1 대분류
  depthMetric: 'weightedAvgChangeRate', // 1-2 시총 가중
  depthMetricMaxIndex: 0, // 1-3 대분류만
  topPickDepth: 0, // 1-4 대분류
  tierRange: 'topTwoTiers', // 2-1 초대형주+대형주
  boxSizeMarketCapRatio: 100, // 3-1 100%
  boxLabelMinAreaPercent: 0.01, // 3-3 0.01%
  decimalPlacesIndex: 2, // 3-4 2자리
}

export const GUEST_DEFAULTS: SettingDefaults = { ...MEMBER_DEFAULTS, ...GUEST_OVERRIDES }

export function settingDefaultsFor(isLoggedIn: boolean): SettingDefaults {
  return isLoggedIn ? MEMBER_DEFAULTS : GUEST_DEFAULTS
}
