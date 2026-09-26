import client from './client'
import { AuthSessionResponseSchema } from '@/types/api'

// 전체 페이지 이동(팝업/XHR 아님)으로 열어야 하는 로그인 시작 URL. returnTo는 로그인 성공 후
// 돌아올 프론트엔드 경로("/"로 시작하는 절대 경로)만 허용된다(백엔드가 그 외 값은 400으로 거절).
export const googleLoginUrl = (returnTo: string) =>
  `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`

export const getSession = () =>
  client.get('/auth/session').then(r => AuthSessionResponseSchema.parse(r.data))

export const logout = () => client.post('/auth/logout')
