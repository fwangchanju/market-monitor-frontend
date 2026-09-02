import { useEffect, useState } from 'react'

// 브라우저 자체의 진짜 Fullscreen API를 토글한다. 사용자가 F11 키나 Esc로 직접 빠져나가는
// 경우도 있어서 fullscreenchange 이벤트로 상태를 동기화한다.
export function useNativeFullscreen() {
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)

  useEffect(() => {
    const handleFullscreenChange = () => setIsNativeFullscreen(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleToggleNativeFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  return { isNativeFullscreen, handleToggleNativeFullscreen }
}
