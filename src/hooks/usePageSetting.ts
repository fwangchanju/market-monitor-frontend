import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { usePersistedState } from './usePersistedState'
import { useCustomPreferences } from './useCustomPreferences'
import { useIsLoggedIn } from './useSession'

// 화면 설정(마켓맵/섹터 페이지의 옵션 사이드바 값 등) 하나를 저장하는 훅 — usePersistedState와 동일한
// [value, setValue] 시그니처라 기존 호출부를 그대로 교체할 수 있다.
//
// - 비로그인, 또는 로그인했지만 서버 설정을 아직 못 받아온 동안: 기존과 동일하게 sessionStorage에만
//   저장한다(가입/로그인 지시서: "초기 로드가 끝나기 전에는 디바운스 저장을 막는다").
// - 로그인 + 서버 설정 로드 완료: 값의 출처가 서버로 바뀐다. 서버 payload에 이 키가 없으면(=사용자가
//   아직 한 번도 안 바꿈) initialValue(코드 기본값)를 쓰고, sessionStorage에 이미 있던 값은 절대
//   자동으로 서버에 올리지 않는다 — 조회만 하지 않을 뿐 sessionStorage 쓰기 자체는 계속되므로
//   (setSessionValue를 별도로 부르지 않지만 usePersistedState 훅은 그대로 살아있다) 로그아웃 시
//   다시 같은 sessionStorage 값으로 조용히 폴백한다.
export function usePageSetting<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const isLoggedIn = useIsLoggedIn()
  const { data: preferences, isLoaded, setPreference } = useCustomPreferences()
  const [sessionValue, setSessionValue] = usePersistedState<T>(key, initialValue)

  const useServer = isLoggedIn && isLoaded
  const hasServerValue = useServer && preferences !== undefined && Object.hasOwn(preferences, key)
  const value = useServer ? (hasServerValue ? (preferences![key] as T) : initialValue) : sessionValue

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    next => {
      if (useServer) {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(value) : next
        setPreference(key, resolved)
        return
      }
      setSessionValue(next)
    },
    [useServer, value, setPreference, key, setSessionValue],
  )

  return [value, setValue]
}
