import type { ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export default function Sidebar({ open, onClose, children }: Props) {
  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>{children}</aside>
    </>
  )
}
