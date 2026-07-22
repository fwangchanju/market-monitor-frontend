import type { ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export default function Sidebar({ open, onClose, children }: Props) {
  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-black/50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-30 flex w-80 max-w-[90vw] flex-col gap-4 overflow-y-auto border-l border-gray-700 bg-[var(--surface)] p-4 transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {children}
      </aside>
    </>
  )
}
