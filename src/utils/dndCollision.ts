import type { ClientRect, CollisionDetection } from '@dnd-kit/core'

/** 드래그 중인 요소와 특정 영역의 교집합이, 두 면적 중 더 작은 쪽 기준으로 차지하는 비율 (0~1). 안 겹치면 0.
 * 더 작은 쪽을 분모로 삼아서, 타겟이 나보다 작아 완전히 뒤덮이는 경우에도 비율이 1에 도달할 수 있다. */
function getOverlapRatio(activeRect: ClientRect, targetRect: ClientRect): number {
  const left = Math.max(activeRect.left, targetRect.left)
  const top = Math.max(activeRect.top, targetRect.top)
  const right = Math.min(activeRect.left + activeRect.width, targetRect.left + targetRect.width)
  const bottom = Math.min(activeRect.top + activeRect.height, targetRect.top + targetRect.height)

  if (right <= left || bottom <= top) return 0

  const intersectionArea = (right - left) * (bottom - top)
  const activeArea = activeRect.width * activeRect.height
  const targetArea = targetRect.width * targetRect.height
  return intersectionArea / Math.min(activeArea, targetArea)
}

const OVERLAP_THRESHOLD = 0.5

/** 더 작은 쪽 면적의 50%를 초과해서 겹치는 영역만 충돌로 인정한다. 기본 rectIntersection은 조금만
 * 걸쳐도 충돌로 잡아서, 절반 넘게 벗어나는 순간부터 영역 밖으로 취급하려는 의도(제외/해제 동작)에 안 맞는다. */
export const halfOverlapCollisionDetection: CollisionDetection = ({ collisionRect, droppableRects, droppableContainers }) =>
  droppableContainers
    .map((droppableContainer) => {
      const rect = droppableRects.get(droppableContainer.id)
      const overlapRatio = rect ? getOverlapRatio(collisionRect, rect) : 0
      return { id: droppableContainer.id, data: { droppableContainer, value: overlapRatio } }
    })
    .filter((collision) => collision.data.value >= OVERLAP_THRESHOLD)
    .sort((a, b) => b.data.value - a.data.value)
