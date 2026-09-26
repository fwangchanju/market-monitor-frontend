import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { LoginGateContext } from '@/hooks/useLoginGate'
import LoginModal from './LoginModal'

// App 루트에서 한 번만 감싼다 — 어느 화면에서든 useLoginGate()로 같은 팝업을 띄울 수 있다.
export default function LoginGateProvider({ children }: { children: ReactNode }) {
  const localAutoLogin = import.meta.env.DEV && import.meta.env.VITE_LOCAL_AUTO_LOGIN === '1'
  const [returnTo, setReturnTo] = useState<string | null>(null)

  const requireLogin = useCallback((path: string) => {
    if (!localAutoLogin) setReturnTo(path)
  }, [localAutoLogin])
  const close = useCallback(() => setReturnTo(null), [])
  const value = useMemo(() => ({ requireLogin }), [requireLogin])

  return (
    <LoginGateContext.Provider value={value}>
      {children}
      {!localAutoLogin && returnTo !== null && <LoginModal returnTo={returnTo} onClose={close} />}
    </LoginGateContext.Provider>
  )
}
