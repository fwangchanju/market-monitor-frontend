import { useSyncExternalStore } from 'react'

// "임시로 써보기" 값 저장소. 설정창에서 바꾼 값은 서버에 바로 올리지 않고 이 브라우저(sessionStorage)에만 둔다 —
// 저장 버튼을 눌러야 서버로 올라가고(commitDrafts), 초기화 버튼이나 브라우저 종료·새로고침이면 저장값으로 돌아온다(discardDrafts).
// 어떤 키가 설정 값인지는 usePageSetting이 등록한다(같은 sessionStorage의 다른 토글성 값은 건드리지 않기 위해).
const registeredKeys = new Set<string>()
const memoryFallback = new Map<string, unknown>()
const listeners = new Set<() => void>()
let version = 0

function notify() {
  version += 1
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function registerDraftKey(key: string) {
  registeredKeys.add(key)
}

export function readDraft(key: string): { found: boolean; value?: unknown } {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw !== null) return { found: true, value: JSON.parse(raw) }
  } catch {
    // 접근이 막힌 환경에서는 메모리에 둔 값으로 동작한다
  }
  return memoryFallback.has(key) ? { found: true, value: memoryFallback.get(key) } : { found: false }
}

export function writeDraft(key: string, value: unknown) {
  memoryFallback.set(key, value)
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 위와 같음
  }
  notify()
}

function activeDraftKeys(): string[] {
  return [...registeredKeys].filter(key => readDraft(key).found)
}

function removeDraft(key: string) {
  memoryFallback.delete(key)
  try {
    sessionStorage.removeItem(key)
  } catch {
    // 위와 같음
  }
}

export function discardDrafts() {
  activeDraftKeys().forEach(removeDraft)
  notify()
}

// 임시값을 저장값으로 올린다. setPreference는 로그인 사용자의 서버 저장 함수(useCustomPreferences).
export function commitDrafts(setPreference: (key: string, value: unknown) => void) {
  activeDraftKeys().forEach(key => {
    setPreference(key, readDraft(key).value)
    removeDraft(key)
  })
  notify()
}

// 임시값이 하나라도 있으면 true. 값이 바뀔 때마다 다시 그려지게 구독한다.
export function useHasDrafts(): boolean {
  useSyncExternalStore(subscribe, () => version)
  return activeDraftKeys().length > 0
}

// 임시값이 바뀌거나 버려질 때 설정을 쓰는 화면이 다시 그려지게 하는 구독.
export function useDraftVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
