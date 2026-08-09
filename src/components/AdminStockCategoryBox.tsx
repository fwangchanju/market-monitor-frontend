import type { CategoryItem, StockCategoryItem } from '@/types/api'
import CategoryBox from './CategoryBox'
import SortableCategoryBox from './SortableCategoryBox'
import AdminDraggableStockChip from './AdminDraggableStockChip'

interface Props {
  category: CategoryItem
  sortable: boolean
  highlighted: boolean
  items: StockCategoryItem[] | undefined
  chipDropHighlightActive: boolean
  onSelect: () => void
}

export default function AdminStockCategoryBox({
  category,
  sortable,
  highlighted,
  items,
  chipDropHighlightActive,
  onSelect,
}: Props) {
  const content = items?.map((item) => (
    <AdminDraggableStockChip key={item.stockCode} stockCode={item.stockCode} stockName={item.stockName} />
  ))

  return sortable ? (
    <SortableCategoryBox
      categoryId={category.id}
      name={category.name}
      onSelect={onSelect}
      highlighted={highlighted}
      chipDropHighlightActive={chipDropHighlightActive}
    >
      {content}
    </SortableCategoryBox>
  ) : (
    <CategoryBox
      categoryId={category.id}
      name={category.name}
      onSelect={onSelect}
      highlighted={highlighted}
      chipDropHighlightActive={chipDropHighlightActive}
    >
      {content}
    </CategoryBox>
  )
}
