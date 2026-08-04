import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import CategoryBox from './CategoryBox'

interface Props {
  categoryId: number
  name: string
  onSelect: () => void
  highlighted: boolean
  children?: ReactNode
  deleteButton?: ReactNode
}

export default function SortableCategoryBox({ categoryId, name, onSelect, highlighted, children, deleteButton }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `category-box-${categoryId}`,
    data: { type: 'category-box', categoryId },
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style}>
      <CategoryBox
        categoryId={categoryId}
        name={name}
        onSelect={onSelect}
        highlighted={highlighted}
        deleteButton={deleteButton}
        dragHandleProps={{ ...attributes, ...listeners }}
      >
        {children}
      </CategoryBox>
    </div>
  )
}
