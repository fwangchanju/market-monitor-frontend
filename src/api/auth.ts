import client from './client'
import { AuthSessionResponseSchema } from '@/types/api'

// 전체 페이지 이동(팝업/XHR 아님)으로 열어야 하는 로그인 시작 URL. returnTo는 로그인 성공 후
// 돌아올 프론트엔드 경로("/"로 시작하는 절대 경로)만 허용된다(백엔드가 그 외 값은 400으로 거절).
export const googleLoginUrl = (returnTo: string) =>
  `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`

export const getSession = () =>
  client.get('/auth/session').then(r => AuthSessionResponseSchema.parse(r.data))

// api/client.ts의 401 인터셉터가 실패한 요청을 재시도하기 전에 내부적으로 직접 호출한다 — 화면
// 코드에서 이 함수를 직접 부를 일은 거의 없다(세션 갱신이 필요하면 세션을 다시 조회하는 쪽이 맞다).
export const refreshSession = () =>
  client.post('/auth/refresh').then(r => AuthSessionResponseSchema.parse(r.data))

export const logout = () => client.post('/auth/logout')
