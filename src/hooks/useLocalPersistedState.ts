import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'

// 이 브라우저에만 남기는 화면 취향(예: 설정창을 열린 채로 시작할지)을 위한 useState 대체 훅. 탭을 닫아도 유지되고
// 서버에는 보내지 않는다. 접근이 막힌 환경(프라이빗 모드 등)에서는 저장 없이 기본값으로 동작한다.
export function useLocalPersistedState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initialValue : (JSON.parse(raw) as T)
    } catch {
      return initialValue
    }
  })

  const setLocalState = useCallback<Dispatch<SetStateAction<T>>>(
    value => {
      setState(prev => {
        const next = value instanceof Function ? value(prev) : value
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          // 저장이 막혀도 화면 동작은 계속되게 조용히 무시
        }
        return next
      })
    },
    [key],
  )

  return [state, setLocalState]
}
