import { useState } from 'react'
import accountAvatar from '@/assets/account_avatar.png'
import { useSession } from './useSession'

// 사용자 사진 주소(없거나 비로그인이면 기본 이미지). 사진은 <img>로 불러서 axios의 401 갱신을 못 타므로,
// 로딩이 실패하면 그 사진 버전은 기본 이미지로 바꾼다.
export function useProfileImageSrc() {
  const { data: session } = useSession()
  const version = session?.authenticated ? (session.profileImageVersion ?? null) : null
  const [failedVersion, setFailedVersion] = useState<number | null>(null)
  const src = version !== null && failedVersion !== version ? `/api/profile/image?v=${version}` : accountAvatar
  return { src, onError: () => setFailedVersion(version) }
}
