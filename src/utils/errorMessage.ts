import { isAxiosError } from 'axios'

const DEFAULT_ERROR_MESSAGE = '요청 처리 중 오류가 발생했습니다.'

export function getErrorDetail(error: unknown): string {
  if (isAxiosError(error) && typeof error.response?.data?.detail === 'string') {
    return error.response.data.detail
  }
  return DEFAULT_ERROR_MESSAGE
}
