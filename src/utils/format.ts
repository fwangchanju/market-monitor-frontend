/** 소수점 1자리 + 천 단위 콤마 */
const withCommas1 = (value: number): string =>
  value.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** 억 원 단위 값 포맷 (소수점 1자리, 천 단위 콤마) */
export const toEok = (value: number): string => {
  if (value === 0) return '0'
  return withCommas1(value)
}

/** 부호 포함 억 원 단위 포맷 */
export const toEokSigned = (value: number): string => {
  const sign = value > 0 ? '+' : ''
  return `${sign}${withCommas1(value)}`
}

/** 백만 원 단위 그대로 표시, 부호 포함, 천 단위 콤마 */
export const toMlnSigned = (value: number): string => {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('ko-KR')}`
}

/** 백만 원 단위 → 억 원 변환 포맷 (천 단위 콤마) */
export const toEokFromMln = (value: number): string => {
  if (value === 0) return '0'
  return withCommas1(value / 100)
}

/** 백만 원 단위 → 억 원 변환, 부호 포함 */
export const toEokSignedFromMln = (value: number): string => {
  const eok = value / 100
  const sign = eok > 0 ? '+' : ''
  return `${sign}${withCommas1(eok)}`
}

/** 천 원 단위 → 억 원 변환 포맷 (천 단위 콤마) */
export const toEokFromThousand = (value: number): string => {
  if (value === 0) return '0'
  return withCommas1(value / 100_000)
}

/** 퍼센트 포맷 (소수점 2자리, 부호 포함) */
export const toPctSigned = (value: number): string => {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/** 퍼센트 포맷 (소수점 2자리) */
export const toPct = (value: number): string => `${value.toFixed(2)}%`

/** LocalDateTime(ISO) → 'HH:mm' */
export const toTimeLabel = (iso: string | null): string => {
  if (!iso) return '-'
  return iso.slice(11, 16)
}

/** LocalDateTime(ISO) → 'MM/DD HH:mm' */
export const toDateTimeLabel = (iso: string | null): string => {
  if (!iso) return '-'
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`
}

/** LocalDate(ISO) → 'MM/DD' */
export const toDateLabel = (iso: string): string => iso.slice(5, 10)

/** LocalDate(ISO) → 'yy/MM/dd' */
export const toYyMmDd = (iso: string): string => iso.slice(2, 10).replace(/-/g, '/')

/** 양수면 'positive', 음수면 'negative', 0이면 '' */
export const signClass = (value: number): string => {
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return ''
}

/** 지수 값 포맷 (소수점 2자리, 천 단위 콤마) */
export const toIndex = (value: number): string =>
  value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 거래량 포맷 (천 단위 콤마) */
export const toVolume = (value: number): string =>
  value.toLocaleString('ko-KR')

/** 시장명 한글 */
export const marketLabel = (market: string): string => {
  if (market === 'ALL') return '전체'
  return market
}

/** 투자자 구분 한글 */
export const investorLabel = (type: string): string => {
  const map: Record<string, string> = {
    PERSONAL: '개인',
    FOREIGNER: '외국인',
    INSTITUTION: '기관',
    FINANCIAL_INVESTMENT: '금투',
    TRUST: '투신',
    PENSION_FUND: '연기금',
    PRIVATE_FUND: '사모',
    INSURANCE: '보험',
    BANK: '은행',
    OTHER_CORP: '기타법인',
    GOVERNMENT: '국가',
    OTHER_FINANCE: '기타금융',
    FOREIGN_COMPANY: '외국계',
    FOREIGN_TOTAL: '외국계합',
  }
  return map[type] ?? type
}

/** 랭킹 구분 한글 */
export const rankingLabel = (type: string): string =>
  type === 'NET_BUY' ? '순매수' : '순매도'
