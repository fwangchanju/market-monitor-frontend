import { useDraggable } from '@dnd-kit/core'

interface Props {
  source: 'main' | 'watch' | 'search'
  stockCode: string
  stockName: string
}

export default function DraggableStockChip({ source, stockCode, stockName }: Props) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `${source}-${stockCode}`,
    data: { source, stockCode },
  })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="nes-container is-rounded flex cursor-grab flex-col gap-1 px-2 py-1"
    >
      <span className="text-xs">{stockName}</span>
      <span className="text-xs text-gray-500">{stockCode}</span>
    </div>
  )
}
