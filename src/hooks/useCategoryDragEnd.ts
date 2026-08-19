import type { DragEndEvent } from '@dnd-kit/core'
import { useReparentCategory } from './useMarketMapAdmin'

type CategoryDragData = { categoryId: number; parentId: number | null }
type CategoryDropData = { categoryId: number }

export function useCategoryDragEnd() {
  const reparentCategory = useReparentCategory()

  return (event: DragEndEvent) => {
    const dragData = event.active.data.current as CategoryDragData | undefined
    if (!dragData) return

    // 드롭존(다른 카테고리) 위가 아니면 최상위로, 위면 그 카테고리의 자식으로.
    const overData = event.over?.data.current as CategoryDropData | undefined
    const newParentId = overData ? overData.categoryId : null

    // 원래 있던 자리에 그대로 놓았거나(같은 부모), 자기 자신 위에 놓았으면(클릭만 하고 거의
    // 안 움직인 경우 자기 행이 드롭존으로 잡힘) 요청 자체를 보내지 않는다. 후자를 안 걸러내면
    // 백엔드 순환참조 에러가 그대로 알림으로 떠서, 사용자는 그냥 클릭한 것뿐인데 뭘 잘못했나 헷갈린다.
    if (newParentId === dragData.parentId || newParentId === dragData.categoryId) return

    reparentCategory.mutate({ id: dragData.categoryId, parentId: newParentId })
  }
}
