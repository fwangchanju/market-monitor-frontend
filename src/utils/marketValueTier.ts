import type { MarketValueTier } from '@/types/api'

// 실제 판정 기준(5천억/5조/200조)은 백엔드가 marketValueTier 필드로 계산해서 내려주므로,
// 여기서는 화면에 보여줄 라벨/설명 문구만 관리한다. 어드민 종목관리·마켓맵 설정 양쪽에서 재사용.
export const MARKET_VALUE_TIER_OPTIONS: { value: MarketValueTier; label: string; range: string }[] = [
  { value: 'MEGA', label: '초대형주', range: '200조 이상' },
  { value: 'LARGE', label: '대형주', range: '5조 이상' },
  { value: 'MID', label: '중형주', range: '5천억 이상' },
  { value: 'SMALL', label: '소형주', range: '5천억 미만' },
]

// 시가총액 구간 슬라이더는 작은 것부터 큰 순서로 왼쪽→오른쪽에 배치한다(위 옵션 목록과는 반대 순서).
export const MARKET_VALUE_TIER_ASCENDING: MarketValueTier[] = ['SMALL', 'MID', 'LARGE', 'MEGA']
export const MARKET_VALUE_TIER_SHORT_LABEL: Record<MarketValueTier, string> = {
  SMALL: '소형주',
  MID: '중형주',
  LARGE: '대형주',
  MEGA: '초대형주',
}
