import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const REDIRECT_DELAY_MS = 3000

export default function PermissionDenied() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => navigate('/', { replace: true }), REDIRECT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-white">접근 권한이 없습니다.</p>
    </div>
  )
}
