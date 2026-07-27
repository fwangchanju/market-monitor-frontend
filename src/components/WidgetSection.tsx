import type { ReactNode } from 'react'

interface Props {
  title: string
  unit?: ReactNode
  actions?: ReactNode
  stale?: boolean
  children: ReactNode
}

export default function WidgetSection({ title, unit, actions, stale, children }: Props) {
  return (
    <section className={`section nes-container is-dark ${stale ? 'border-red-500' : ''}`}>
      <div className="mb-2 flex flex-col items-start gap-1 border-b border-gray-600 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className={`text-sm font-bold ${stale ? 'text-red-400' : ''}`}>{title}</h2>
        {unit && <span className="text-xs text-gray-500">{unit}</span>}
      </div>
      {actions && <div className="mb-3 flex flex-wrap items-center gap-4">{actions}</div>}
      {children}
    </section>
  )
}
