import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { LoginGateContext } from '@/hooks/useLoginGate'
import LoginModal from './LoginModal'
import { isLocalAutoLoginEnabled } from '@/utils/localDevLogin'

// App 루트에서 한 번만 감싼다 — 어느 화면에서든 useLoginGate()로 같은 팝업을 띄울 수 있다.
export default function LoginGateProvider({ children }: { children: ReactNode }) {
  // 로컬 자동 로그인이 켜져 있으면 팝업 대신 자동으로 로그인되므로 팝업을 열지 않는다(?guest=1이면 정상으로 연다).
  const localAutoLogin = isLocalAutoLoginEnabled()
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
