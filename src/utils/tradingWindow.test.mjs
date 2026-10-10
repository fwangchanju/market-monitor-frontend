import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isAfterHoursSelectable, shouldShowAfterHoursControls } from './tradingWindow.ts'

test('시간외 시작이 늦은 날에는 실제 경계부터 선택할 수 있다', () => {
  const boundary = '2025-11-13T16:40:00'
  assert.equal(isAfterHoursSelectable('2025-11-13T15:40:00', boundary), false)
  assert.equal(isAfterHoursSelectable('2025-11-13T16:35:00', boundary), false)
  assert.equal(isAfterHoursSelectable('2025-11-13T16:40:00', boundary), true)
  assert.equal(isAfterHoursSelectable('2025-11-13T20:00:00', boundary), true)
})

test('경계가 없으면 15:40을 사용하고 가격이 없으면 선택할 수 없다', () => {
  assert.equal(isAfterHoursSelectable('2026-10-08T15:35:00'), false)
  assert.equal(isAfterHoursSelectable('2026-10-08T15:40:00'), true)
  assert.equal(isAfterHoursSelectable(null), false)
})

test('조회 날짜가 다른 비교 스냅샷에는 시간외 기준을 섞지 않는다', () => {
  assert.equal(isAfterHoursSelectable('2025-11-12T20:00:00', '2025-11-13T16:40:00'), false)
})

test('오늘의 지연된 시간외 시작 전에는 버튼을 숨긴다', () => {
  const boundary = '2025-11-13T16:40:00'
  assert.equal(shouldShowAfterHoursControls(new Date('2025-11-13T16:35:00+09:00'), boundary), false)
  assert.equal(shouldShowAfterHoursControls(new Date('2025-11-13T16:40:00+09:00'), boundary), true)
})

test('평일 오전에는 이전 거래일 시간외 스냅샷이 남아 있어도 버튼을 숨긴다', () => {
  const previousBoundary = '2026-10-07T15:40:00'
  assert.equal(shouldShowAfterHoursControls(new Date('2026-10-08T07:59:00+09:00'), previousBoundary), true)
  assert.equal(shouldShowAfterHoursControls(new Date('2026-10-08T08:00:00+09:00'), previousBoundary), false)
  assert.equal(shouldShowAfterHoursControls(new Date('2026-10-08T15:40:00+09:00'), previousBoundary), true)
})

test('주말에는 마지막 거래일의 시간외 데이터를 계속 볼 수 있다', () => {
  assert.equal(shouldShowAfterHoursControls(new Date('2026-10-10T12:00:00+09:00'), '2026-10-08T15:40:00'), true)
})
