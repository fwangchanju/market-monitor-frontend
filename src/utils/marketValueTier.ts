import type { MarketValueTier } from '@/types/api'

// 실제 판정 기준(5천억/5조/200조)은 백엔드가 marketValueTier 필드로 계산해서 내려주므로,
// 여기서는 화면에 보여줄 라벨/설명 문구만 관리한다. 어드민 종목관리·마켓맵 설정 양쪽에서 재사용.
export const MARKET_VALUE_TIER_OPTIONS: { value: MarketValueTier; label: string; range: string }[] = [
  { value: 'MEGA', label: '초대형주', range: '200조 이상' },
  { value: 'LARGE', label: '대형주', range: '5조 이상' },
  { value: 'MID', label: '중형주', range: '5천억 이상' },
  { value: 'SMALL', label: '소형주', range: '5천억 미만' },
]
