import type { ReactNode } from 'react'

interface Props {
  title: string
  actions?: ReactNode
  stale?: boolean
  children: ReactNode
}

export default function WidgetSection({ title, actions, stale, children }: Props) {
  return (
    <section className={`nes-container is-dark ${stale ? 'border-red-500' : ''}`}>
      <div className="mb-3 flex flex-col items-start gap-2 border-b border-gray-600 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className={`text-sm font-bold ${stale ? 'text-red-400' : ''}`}>{title}</h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}
