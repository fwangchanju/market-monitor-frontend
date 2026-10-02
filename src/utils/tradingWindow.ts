// KRX와 NXT의 거래 시간대(한국 시간, 평일).
// - NXT 단독: 08:00~08:50, 15:40~16:00 — KRX는 열리지 않아서 NXT 거래 종목만 거래된다.
// - 공통: 09:00~15:30, 16:00~20:00 — 두 거래소가 같이 연다. 전체 종목을 보여준다.
// 그 밖의 시간(단일가 구간·장 마감 후·주말)은 NXT 단독이 아니므로 전체 종목을 보여준다. 공휴일은 따로 구분하지 않는다.
export interface NxtOnlyWindow {
  // 화면에 그대로 보여주는 시간 범위.
  label: string
  // 시간대 이름 — 정해진 이름이 있는 것만 둔다.
  name?: string
  fromMinutes: number
  toMinutes: number
}

const NXT_ONLY_WINDOWS: readonly NxtOnlyWindow[] = [
  { label: '08:00 ~ 08:50', name: '프리마켓', fromMinutes: 8 * 60, toMinutes: 8 * 60 + 50 },
  { label: '15:40 ~ 16:00', fromMinutes: 15 * 60 + 40, toMinutes: 16 * 60 },
]

const KST_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  weekday: 'short',
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

export function isNxtOnlyTime(now: Date): boolean {
  return currentNxtOnlyWindow(now) !== null
}
