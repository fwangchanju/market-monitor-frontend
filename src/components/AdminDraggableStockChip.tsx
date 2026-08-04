import { useDraggable } from '@dnd-kit/core'

interface Props {
  stockCode: string
  stockName: string
}

export default function AdminDraggableStockChip({ stockCode, stockName }: Props) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `stock-${stockCode}`,
    data: { type: 'stock', stockCode, stockName },
  })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        listeners?.onPointerDown?.(e)
        e.stopPropagation()
      }}
      className="nes-container is-rounded is-dark flex cursor-grab flex-col gap-1 border-2 border-transparent px-2 py-1 hover:border-yellow-400 hover:brightness-125"
    >
      <span className="text-[10.5px] text-white">{stockName}</span>
      <span className="text-[10.5px] text-white">{stockCode}</span>
    </div>
  )
}
