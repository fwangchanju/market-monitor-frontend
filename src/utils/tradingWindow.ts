// KRX와 NXT의 거래 시간대(한국 시간, 평일).
// - NXT 단독: 08:00~08:50, 15:40~16:00 — KRX는 열리지 않아서 NXT 거래 종목만 거래된다.
// - 공통: 09:00~15:30, 16:00~20:00 — 두 거래소가 같이 연다. 전체 종목을 보여준다.
// 그 밖의 시간(단일가 구간·장 마감 후·주말)은 NXT 단독이 아니므로 전체 종목을 보여준다. 공휴일은 따로 구분하지 않는다.
export interface NxtOnlyWindow {
  // 화면에 그대로 보여주는 시간 범위.
  label: string
  fromMinutes: number
  toMinutes: number
}

const NXT_ONLY_WINDOWS: readonly NxtOnlyWindow[] = [
  { label: '08:00 ~ 08:50', fromMinutes: 8 * 60, toMinutes: 8 * 60 + 50 },
  { label: '15:40 ~ 16:00', fromMinutes: 15 * 60 + 40, toMinutes: 16 * 60 },
]

const KST_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
})

// 지금이 NXT 단독 시간대면 그 시간대를, 아니면 null을 돌려준다.
export function currentNxtOnlyWindow(now: Date): NxtOnlyWindow | null {
  const parts = KST_PARTS.formatToParts(now)
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  const weekday = value('weekday')
  if (weekday === 'Sat' || weekday === 'Sun') return null
  const minutes = Number(value('hour')) * 60 + Number(value('minute'))
  return NXT_ONLY_WINDOWS.find(window => minutes >= window.fromMinutes && minutes < window.toMinutes) ?? null
}

// 시간외 등락률은 조회 날짜의 시간외 시작 이후에 선택한다. 서버가 준 경계가 없으면 15:40을 사용한다.
// 다음 개장까지 이전 거래일 스냅샷을 보여줄 때도 그 스냅샷 날짜의 경계로 판단한다.
const AFTER_HOURS_START = '15:40'

// 애프터 마켓 시작부터 다음 프리 마켓 개장 직전까지 누적/별도 버튼을 표시한다.
// 주말에는 다음 평일 08:00 개장까지 유지한다. 다른 시간대 판단과 같이 공휴일은 별도로 구분하지 않는다.
export function shouldShowAfterHoursControls(now: Date, afterHoursStart?: string | null): boolean {
  const parts = KST_PARTS.formatToParts(now)
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  const weekday = value('weekday')
  if (weekday === 'Sat' || weekday === 'Sun') return true
  const minutes = Number(value('hour')) * 60 + Number(value('minute'))
  const today = `${value('year')}-${value('month')}-${value('day')}`
  const start = afterHoursStart?.slice(0, 10) === today ? afterHoursStart.slice(11, 16) : AFTER_HOURS_START
  const [hour, minute] = start.split(':').map(Number)
  return minutes >= hour * 60 + minute || minutes < 8 * 60
}

export function isAfterHoursSelectable(snapshotTime: string | null | undefined, afterHoursStart?: string | null): boolean {
  if (!snapshotTime) return false
  // snapshotTime은 한국 시각 그대로의 "YYYY-MM-DDTHH:mm:ss" 문자열이다.
  if (afterHoursStart) return snapshotTime >= afterHoursStart
  return snapshotTime.slice(11, 16) >= AFTER_HOURS_START
}

export function isNxtOnlyTime(now: Date): boolean {
  return currentNxtOnlyWindow(now) !== null
}

// 지금 시장이 어느 시간대인지(한국 시간, 평일) — 상단바 After-Market 묶음의 말머리로 쓴다.
// 08:00~09:00 프리 마켓(08:50~09:00 동시 호가 구간에도 지도에는 프리 마켓 데이터가 나온다), 09:00~15:30 메인 마켓, 15:40~20:00 애프터 마켓.
// 15:30~15:40은 KRX·NXT가 둘 다 닫혀 있고, 20:00 이후·08:00 이전·주말과 함께 "마켓 종료"이다. 공휴일은 구분하지 않는다.
export type TradingSession = '프리 마켓' | '메인 마켓' | '애프터 마켓' | '마켓 종료'

export function currentTradingSession(now: Date): TradingSession {
  const parts = KST_PARTS.formatToParts(now)
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  const weekday = value('weekday')
  if (weekday === 'Sat' || weekday === 'Sun') return '마켓 종료'
  const minutes = Number(value('hour')) * 60 + Number(value('minute'))
  if (minutes >= 8 * 60 && minutes < 9 * 60) return '프리 마켓'
  if (minutes >= 9 * 60 && minutes < 15 * 60 + 30) return '메인 마켓'
  if (minutes >= 15 * 60 + 40 && minutes < 20 * 60) return '애프터 마켓'
  return '마켓 종료'
}

// 이름 중 가장 긴 것 — 상단바 말머리는 이 이름의 너비를 기준으로 자리를 잡아서 시간대가 바뀌어도 시작 위치가 같다.
export const LONGEST_TRADING_SESSION: TradingSession = '애프터 마켓'
