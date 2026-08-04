import type { CategoryItem, StockCategoryItem } from '@/types/api'
import CategoryBox from './CategoryBox'
import SortableCategoryBox from './SortableCategoryBox'
import AdminDraggableStockChip from './AdminDraggableStockChip'

interface Props {
  category: CategoryItem
  sortable: boolean
  highlighted: boolean
  stockCategories: StockCategoryItem[] | undefined
  onSelect: () => void
}

export default function AdminStockCategoryBox({ category, sortable, highlighted, stockCategories, onSelect }: Props) {
  const items = stockCategories?.filter((a) => a.categoryName === category.name)

  const content = items?.map((item) => (
    <AdminDraggableStockChip key={item.stockCode} stockCode={item.stockCode} stockName={item.stockName} />
  ))

  return sortable ? (
    <SortableCategoryBox categoryId={category.id} name={category.name} onSelect={onSelect} highlighted={highlighted}>
      {content}
    </SortableCategoryBox>
  ) : (
    <CategoryBox categoryId={category.id} name={category.name} onSelect={onSelect} highlighted={highlighted}>
      {content}
    </CategoryBox>
  )
}
