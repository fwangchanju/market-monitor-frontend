import type { Key, ReactNode } from 'react'

export interface DataTableColumn<T> {
  header: string
  align?: 'left' | 'right'
  width?: number
  render: (item: T, index: number) => ReactNode
  cellClassName?: (item: T, index: number) => string | undefined
}

interface Props<T> {
  items: T[]
  columns: DataTableColumn<T>[]
  rowKey: (item: T, index: number) => Key
}

export default function DataTable<T>({ items, columns, rowKey }: Props<T>) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map(c => (
            <th
              key={c.header}
              className={c.align === 'left' ? 'left' : undefined}
              style={c.width ? { width: c.width } : undefined}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => (
          <tr key={rowKey(item, index)}>
            {columns.map(c => {
              const alignClass = c.align === 'left' ? 'left' : undefined
              const cellClass = c.cellClassName?.(item, index)
              return (
                <td key={c.header} className={[alignClass, cellClass].filter(Boolean).join(' ') || undefined}>
                  {c.render(item, index)}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
