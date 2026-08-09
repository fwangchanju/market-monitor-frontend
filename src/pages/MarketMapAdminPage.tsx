import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import NavBar from '@/components/NavBar'
import AdminSidebar from '@/components/AdminSidebar'
import PermissionDenied from '@/components/PermissionDenied'
// import AdminStockSearchSection from '@/components/AdminStockSearchSection'
// import AdminCategorySearchSection from '@/components/AdminCategorySearchSection'
import AdminStockCategoryBox from '@/components/AdminStockCategoryBox'
import AdminCategoryAddBox from '@/components/AdminCategoryAddBox'
import AdminCategoryManageBox from '@/components/AdminCategoryManageBox'
import {
  useAdminCategories,
  useAssignStockCategory,
  useReorderCategory,
  useReparentCategory,
  useStockCategories,
} from '@/hooks/useMarketMapAdmin'
import { useCategoryDrilldown } from '@/hooks/useCategoryDrilldown'
import { adminCollisionDetection } from '@/utils/adminCollision'
import type { StockCategoryItem } from '@/types/api'

type StockDragData = { type: 'stock'; stockCode: string }
type CategoryBoxDragData = { type: 'category-box'; categoryId: number }
type CategoryChipDragData = { type: 'category-chip'; categoryId: number; categoryName: string; parentId: number }
type CategoryDropData = { type: 'category-target' | 'category-content'; categoryId: number }

export default function MarketMapAdminPage() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'stock' ? 'stock' : 'category'
  const [draggingStockCode, setDraggingStockCode] = useState<string | null>(null)
  const [draggingCategoryChipParentId, setDraggingCategoryChipParentId] = useState<number | null>(null)
  const [draggingType, setDraggingType] = useState<'stock' | 'category-box' | 'category-chip' | null>(null)
  const { data: categories, error: categoriesError } = useAdminCategories()
  const { data: stockCategories } = useStockCategories()
  const { currentCategory, currentDepthCategories, enterCategory, goBack } = useCategoryDrilldown(categories)
  const assignStockCategory = useAssignStockCategory()
  const reorderCategory = useReorderCategory()
  const reparentCategory = useReparentCategory()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const stocksByCategoryName = useMemo(() => {
    const map = new Map<string, StockCategoryItem[]>()
    for (const item of stockCategories ?? []) {
      const list = map.get(item.categoryName)
      if (list) list.push(item)
      else map.set(item.categoryName, [item])
    }
    return map
  }, [stockCategories])

  const isChipDragActive = draggingType === 'stock' || draggingType === 'category-chip'

  const groupTitle = currentCategory ? `${currentCategory.name} - 세부 카테고리 목록` : '카테고리 목록'
  const originCategoryName = draggingStockCode
    ? (stockCategories?.find((a) => a.stockCode === draggingStockCode)?.categoryName ?? null)
    : null

  const resetDragState = () => {
    setDraggingStockCode(null)
    setDraggingCategoryChipParentId(null)
    setDraggingType(null)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current as StockDragData | CategoryBoxDragData | CategoryChipDragData | undefined
    setDraggingStockCode(activeData?.type === 'stock' ? activeData.stockCode : null)
    setDraggingCategoryChipParentId(activeData?.type === 'category-chip' ? activeData.parentId : null)
    setDraggingType(activeData?.type ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    resetDragState()
    const activeData = event.active.data.current as StockDragData | CategoryBoxDragData | CategoryChipDragData | undefined
    if (!activeData) return

    if (activeData.type === 'stock') {
      const overData = event.over?.data.current as CategoryDropData | undefined
      if (overData?.type === 'category-target' || overData?.type === 'category-content') {
        assignStockCategory.mutate({ stockCode: activeData.stockCode, categoryId: overData.categoryId })
      }
      return
    }

    if (activeData.type === 'category-chip') {
      const overData = event.over?.data.current as CategoryDropData | undefined
      if (overData?.type === 'category-content' && overData.categoryId !== activeData.parentId) {
        reparentCategory.mutate({ id: activeData.categoryId, parentId: overData.categoryId })
      }
      return
    }

    if (activeData.type === 'category-box' && event.over) {
      const oldIndex = currentDepthCategories.findIndex((c) => `category-box-${c.id}` === event.active.id)
      const newIndex = currentDepthCategories.findIndex((c) => `category-box-${c.id}` === event.over!.id)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
      reorderCategory.mutate({ id: activeData.categoryId, displayOrder: newIndex + 1 })
    }
  }

  if (isAxiosError(categoriesError) && categoriesError.response?.status === 403) {
    return <PermissionDenied />
  }

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <DndContext
        sensors={sensors}
        collisionDetection={adminCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={resetDragState}
      >
        <div className="flex flex-1">
          <AdminSidebar mode={mode} />
          <div className="flex-1 p-4">
            {/* {mode === 'stock' && (
              <div className="flex flex-wrap gap-2">
                <AdminStockSearchSection />
                <AdminCategorySearchSection />
              </div>
            )} */}

            <div className="mt-4">
              {currentCategory ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="mb-2 rounded border-2 border-transparent bg-transparent px-2 py-1 text-left text-sm font-bold text-white hover:border-yellow-400 hover:brightness-125"
                >
                  {groupTitle}
                </button>
              ) : (
                <p className="mb-2 px-2 text-sm font-bold text-white">{groupTitle}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {mode === 'stock' ? (
                  <>
                    {currentCategory && (
                      <AdminStockCategoryBox
                        category={currentCategory}
                        sortable={false}
                        highlighted={currentCategory.name === originCategoryName}
                        items={stocksByCategoryName.get(currentCategory.name)}
                        chipDropHighlightActive={isChipDragActive}
                        onSelect={() => {}}
                      />
                    )}
                    <SortableContext
                      items={currentDepthCategories.map((c) => `category-box-${c.id}`)}
                      strategy={rectSortingStrategy}
                    >
                      {currentDepthCategories.map((category) => (
                        <AdminStockCategoryBox
                          key={category.id}
                          category={category}
                          sortable
                          highlighted={category.name === originCategoryName}
                          items={stocksByCategoryName.get(category.name)}
                          chipDropHighlightActive={isChipDragActive}
                          onSelect={() => enterCategory(category.id)}
                        />
                      ))}
                    </SortableContext>
                  </>
                ) : (
                  <>
                    <AdminCategoryAddBox parentId={currentCategory?.id ?? null} />
                    {currentCategory && (
                      <AdminCategoryManageBox
                        category={currentCategory}
                        childCategories={undefined}
                        sortable={false}
                        highlighted={currentCategory.id === draggingCategoryChipParentId}
                        chipDropHighlightActive={isChipDragActive}
                        onSelect={() => {}}
                      />
                    )}
                    <SortableContext
                      items={currentDepthCategories.map((c) => `category-box-${c.id}`)}
                      strategy={rectSortingStrategy}
                    >
                      {currentDepthCategories.map((category) => (
                        <AdminCategoryManageBox
                          key={category.id}
                          category={category}
                          childCategories={categories?.filter((c) => c.parentId === category.id)}
                          sortable
                          highlighted={category.id === draggingCategoryChipParentId}
                          chipDropHighlightActive={isChipDragActive}
                          onSelect={() => enterCategory(category.id)}
                        />
                      ))}
                    </SortableContext>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </DndContext>
    </div>
  )
}
