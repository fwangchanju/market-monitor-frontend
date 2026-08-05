import { closestCenter, type CollisionDetection } from '@dnd-kit/core'
import { getOverlapRatio } from './dndCollision'

const OVERLAP_THRESHOLD = 0.5

const STOCK_TARGET_TYPES = ['category-target', 'category-content']
const CATEGORY_CHIP_TARGET_TYPES = ['category-content']

/** 어드민 화면 전용 충돌 판정. 드래그 대상이 카테고리 박스(순서변경, sortable)면 dnd-kit 기본
 * closestCenter로, 종목칩/카테고리칩(카테고리 박스 안으로 배정)이면 면적 겹침 비율 기준으로 판정한다.
 * 같은 화면에 성격이 다른 드래그들이 공존해서 판정 로직 자체를 드래그 종류로 분기해야 한다. */
export const adminCollisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type

  if (activeType === 'category-box') {
    return closestCenter(args)
  }

  const validTargetTypes = activeType === 'stock' ? STOCK_TARGET_TYPES : CATEGORY_CHIP_TARGET_TYPES

  return args.droppableContainers
    .filter((container) => validTargetTypes.includes(container.data.current?.type))
    .map((container) => {
      const rect = args.droppableRects.get(container.id)
      const overlapRatio = rect ? getOverlapRatio(args.collisionRect, rect) : 0
      return { id: container.id, data: { droppableContainer: container, value: overlapRatio } }
    })
    .filter((collision) => collision.data.value >= OVERLAP_THRESHOLD)
    .sort((a, b) => b.data.value - a.data.value)
}
