import type { ReactNode } from 'react'

interface Props {
  title: string
  children?: ReactNode
  highlighted?: boolean
}

export default function AdminSection({ title, children, highlighted = false }: Props) {
  return (
    <div
      className={`nes-container with-title is-dark w-64 shrink-0 ${
        highlighted ? 'outline outline-2 outline-offset-2 outline-yellow-400 brightness-125' : ''
      }`}
    >
      <p className="title text-sm">{title}</p>
      <div className="flex h-48 flex-col gap-2">{children}</div>
    </div>
  )
}
