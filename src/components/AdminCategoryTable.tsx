import { useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { CategoryItem } from '@/types/api'
import { useCreateCategory, useRenameCategory } from '@/hooks/useMarketMapAdmin'
import { useCategoryDeleteFlow } from '@/hooks/useCategoryDeleteFlow'
import { useCategoryDragEnd } from '@/hooks/useCategoryDragEnd'
import { halfOverlapCollisionDetection } from '@/utils/dndCollision'

interface Props {
  categories: CategoryItem[]
}

type Row =
  | { type: 'category'; item: CategoryItem; siblingIndex: number }
  | { type: 'add-child'; parentId: number; parentPath: string[]; depth: number }

// 이름순 정렬하되 "미분류"는 항상 맨 뒤로.
function compareCategoryName(a: CategoryItem, b: CategoryItem): number {
  if (a.name === '미분류') return 1
  if (b.name === '미분류') return -1
  return a.name.localeCompare(b.name, 'ko')
}

// 세부 카테고리 추가 입력창의 placeholder용 — 루트부터 해당 카테고리까지 이름을 전부 이어붙인다.
// (예: 뎁스2 밑에 추가하면 "반도체" - "메모리"의 세부 카테고리 추가. 처럼 조상 전체가 보이게)
function buildPathById(categories: CategoryItem[]): Map<number, string[]> {
  const byId = new Map(categories.map(c => [c.id, c]))
  const cache = new Map<number, string[]>()
  const resolve = (id: number): string[] => {
    const cached = cache.get(id)
    if (cached) return cached
    const category = byId.get(id)!
    const path = category.parentId != null ? [...resolve(category.parentId), category.name] : [category.name]
    cache.set(id, path)
    return path
  }
  for (const c of categories) resolve(c.id)
  return cache
}

function buildVisibleRows(
  categories: CategoryItem[],
  parentId: number | null,
  expandedIds: Set<number>,
  addingChildFor: number | null,
  pathById: Map<number, string[]>,
): Row[] {
  const children = categories.filter(c => c.parentId === parentId).sort(compareCategoryName)
  const rows: Row[] = []
  children.forEach((child, index) => {
    rows.push({ type: 'category', item: child, siblingIndex: index + 1 })
    // 펼침 여부와 무관하게, 세부 카테고리 추가 버튼을 누른 카테고리 바로 아래에 입력줄을 끼워 넣는다.
    if (addingChildFor === child.id) {
      rows.push({ type: 'add-child', parentId: child.id, parentPath: pathById.get(child.id) ?? [child.name], depth: child.depth + 1 })
    }
    if (expandedIds.has(child.id)) {
      rows.push(...buildVisibleRows(categories, child.id, expandedIds, addingChildFor, pathById))
    }
  })
  return rows
}

function buildRowsForRoots(
  categories: CategoryItem[],
  roots: CategoryItem[],
  expandedIds: Set<number>,
  addingChildFor: number | null,
  pathById: Map<number, string[]>,
): Row[] {
  const rows: Row[] = []
  roots.forEach((root, index) => {
    rows.push({ type: 'category', item: root, siblingIndex: index + 1 })
    if (addingChildFor === root.id) {
      rows.push({ type: 'add-child', parentId: root.id, parentPath: pathById.get(root.id) ?? [root.name], depth: root.depth + 1 })
    }
    if (expandedIds.has(root.id)) {
      rows.push(...buildVisibleRows(categories, root.id, expandedIds, addingChildFor, pathById))
    }
  })
  return rows
}

// 카테고리 이름 자체가 드래그 소스 — 별도 손잡이 버튼 없이 이름을 눌러서 바로 끌 수 있다.
function DraggableCategoryName({
  categoryId,
  parentId,
  label,
  className,
}: {
  categoryId: number
  parentId: number | null
  label: string
  className: string
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `category-drag-${categoryId}`,
    data: { categoryId, parentId },
  })
  return (
    <span ref={setNodeRef} {...listeners} {...attributes} className={`${className} ${isDragging ? 'opacity-30' : ''}`}>
      {label}
    </span>
  )
}

// 다른 카테고리가 이 카테고리 위로 드롭되면 그 자식으로 재배정되는 드롭존. 행 전체를 감싼다.
function DroppableCategoryRow({
  categoryId,
  className,
  children,
}: {
  categoryId: number
  className: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `category-drop-${categoryId}`,
    data: { categoryId },
  })
  return (
    <tr ref={setNodeRef} className={`${className} ${isOver ? 'bg-yellow-400/20' : ''}`}>
      {children}
    </tr>
  )
}

export default function AdminCategoryTable({ categories }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [newName, setNewName] = useState('')
  const [childNameByParent, setChildNameByParent] = useState<Record<number, string>>({})
  // 펼침과 무관하게 "지금 이 카테고리 밑에 추가 입력줄을 보여줄지"만 따로 관리 — 한 번에 하나만 연다.
  const [addingChildFor, setAddingChildFor] = useState<number | null>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const [isDraggingCategory, setIsDraggingCategory] = useState(false)
  const [draggedCategory, setDraggedCategory] = useState<CategoryItem | null>(null)

  const createCategory = useCreateCategory()
  const renameCategory = useRenameCategory()
  const { remove } = useCategoryDeleteFlow()
  const handleCategoryDragEnd = useCategoryDragEnd()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const pathById = useMemo(() => buildPathById(categories), [categories])
  const hasChildren = (id: number) => categories.some(c => c.parentId === id)

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExpandAll = () => setExpandedIds(new Set(categories.filter(c => hasChildren(c.id)).map(c => c.id)))
  const handleCollapseAll = () => setExpandedIds(new Set())

  const toggleAddChild = (id: number) => {
    setAddingChildFor(prev => (prev === id ? null : id))
  }

  const triggerHighlight = (id: number) => {
    setHighlightedId(id)
    setTimeout(() => setHighlightedId(current => (current === id ? null : current)), 2000)
  }

  const handleCreate = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    createCategory.mutate({ name: trimmed, parentId: null }, { onSuccess: created => triggerHighlight(created.id) })
    setNewName('')
  }

  const handleCreateChild = (parentId: number) => {
    const trimmed = (childNameByParent[parentId] ?? '').trim()
    if (!trimmed) return
    createCategory.mutate({ name: trimmed, parentId }, { onSuccess: created => triggerHighlight(created.id) })
    setChildNameByParent(prev => ({ ...prev, [parentId]: '' }))
  }

  const startRename = (category: CategoryItem) => {
    setRenamingId(category.id)
    setRenameValue(category.name)
  }

  const cancelRename = () => setRenamingId(null)

  const submitRename = (category: CategoryItem) => {
    const trimmed = renameValue.trim()
    setRenamingId(null)
    if (!trimmed || trimmed === category.name) return
    renameCategory.mutate({ id: category.id, name: trimmed }, { onSuccess: () => triggerHighlight(category.id) })
  }

  const rootCategories = categories.filter(c => c.parentId === null).sort(compareCategoryName)
  const splitIndex = Math.ceil(rootCategories.length / 2)
  const leftRoots = rootCategories.slice(0, splitIndex)
  const rightRoots = rootCategories.slice(splitIndex)
  const leftRows = buildRowsForRoots(categories, leftRoots, expandedIds, addingChildFor, pathById)
  const rightRows = buildRowsForRoots(categories, rightRoots, expandedIds, addingChildFor, pathById)

  const rootIndexById = new Map<number, number>()
  rootCategories.forEach((c, i) => rootIndexById.set(c.id, i + 1))

  const renderRow = (row: Row) => {
    if (row.type === 'add-child') {
      const parentId = row.parentId
      const quotedPath = row.parentPath.map(name => `"${name}"`).join(' - ')
      return (
        <tr key={`add-child-${parentId}`}>
          <td className="py-0.5 text-left" style={{ paddingLeft: `${row.depth * 20 + 8}px` }}>
            <div className="group/create flex items-center gap-2">
              <span className="shrink-0 text-gray-400">-</span>
              <input
                type="text"
                autoFocus
                value={childNameByParent[parentId] ?? ''}
                onChange={e => setChildNameByParent(prev => ({ ...prev, [parentId]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateChild(parentId)
                  if (e.key === 'Escape') setAddingChildFor(null)
                }}
                placeholder={`${quotedPath}의 세부 카테고리 추가.`}
                className="nes-input is-dark min-w-0 flex-1 text-sm"
              />
              <button
                type="button"
                onClick={() => handleCreateChild(parentId)}
                className="nes-btn shrink-0 border-[#4f8fd6] bg-[#4f8fd6] px-3 py-1 text-sm text-white opacity-0 transition-opacity hover:brightness-125 group-focus-within/create:opacity-100"
              >
                추가
              </button>
            </div>
          </td>
        </tr>
      )
    }

    const category = row.item
    const isRoot = category.parentId === null
    const expandable = isRoot || hasChildren(category.id)
    const label = isRoot ? `${rootIndexById.get(category.id)}. ${category.name}` : `${row.siblingIndex}) ${category.name}`
    const isRenaming = renamingId === category.id
    return (
      <DroppableCategoryRow
        key={category.id}
        categoryId={category.id}
        className={`group ${highlightedId === category.id ? 'animate-row-blink' : ''}`}
      >
        <td className="py-0.5 text-left" style={{ paddingLeft: `${category.depth * 20 + 8}px` }}>
          <div className="flex items-center gap-6">
            <div className={`flex items-center ${isRenaming ? 'min-w-0 flex-1' : ''}`}>
              {expandable ? (
                <button
                  type="button"
                  onClick={() => toggleExpand(category.id)}
                  className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-transparent text-gray-400 hover:text-yellow-400"
                >
                  {expandedIds.has(category.id) ? '▾' : '▸'}
                </button>
              ) : (
                <span className="mr-1 inline-block h-6 w-6 shrink-0" />
              )}
              {isRenaming ? (
                <input
                  type="text"
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitRename(category)
                    if (e.key === 'Escape') cancelRename()
                  }}
                  className="nes-input is-dark min-w-0 flex-1 text-sm"
                />
              ) : (
                <DraggableCategoryName
                  categoryId={category.id}
                  parentId={category.parentId}
                  label={label}
                  className="cursor-grab touch-none truncate text-left text-white hover:text-yellow-400 active:cursor-grabbing"
                />
              )}
            </div>
            <div
              className={`flex shrink-0 items-center gap-3 ${isRenaming ? '' : 'opacity-0 transition-opacity group-hover:opacity-100'}`}
            >
              {isRenaming ? (
                <>
                  <button
                    type="button"
                    onClick={() => submitRename(category)}
                    className="nes-btn border-[#4f8fd6] bg-[#4f8fd6] px-3 py-1 text-sm text-white hover:brightness-125"
                  >
                    확인
                  </button>
                  <button
                    type="button"
                    onClick={cancelRename}
                    className="nes-btn border-gray-600 bg-black px-3 py-1 text-sm text-white hover:bg-gray-800"
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => toggleAddChild(category.id)}
                    className="nes-btn border-sky-500 bg-sky-500 px-3 py-1 text-sm text-white hover:bg-sky-600"
                  >
                    추가
                  </button>
                  <button
                    type="button"
                    onClick={() => startRename(category)}
                    className="nes-btn border-[#4f8fd6] bg-[#4f8fd6] px-3 py-1 text-sm text-white hover:brightness-125"
                  >
                    변경
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(category.id, category.name)}
                    className="nes-btn border-red-600 bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          </div>
        </td>
      </DroppableCategoryRow>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={halfOverlapCollisionDetection}
      onDragStart={event => {
        setIsDraggingCategory(true)
        const dragData = event.active.data.current as { categoryId: number } | undefined
        setDraggedCategory(dragData ? (categories.find(c => c.id === dragData.categoryId) ?? null) : null)
      }}
      onDragEnd={event => {
        setIsDraggingCategory(false)
        setDraggedCategory(null)
        handleCategoryDragEnd(event)
      }}
      onDragCancel={() => {
        setIsDraggingCategory(false)
        setDraggedCategory(null)
      }}
    >
      <div>
        <div className="mb-2 flex min-h-[38px] items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold text-white">카테고리 목록</p>
            <button
              type="button"
              onClick={handleExpandAll}
              className="nes-btn border-[#4f8fd6] bg-[#4f8fd6] px-2 py-1 text-xs text-white hover:brightness-125"
            >
              펼치기
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="nes-btn border-red-600 bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
            >
              접기
            </button>
          </div>
          {isDraggingCategory && (
            <p className="text-sm text-yellow-400">다른 카테고리 위에 놓으면 그 밑으로, 빈 곳에 놓으면 최상위로 이동합니다</p>
          )}
        </div>
        <div className="mb-4 overflow-x-auto scrollbar-hide">
          <table className="nes-table is-dark is-bordered w-full text-sm [&_td]:border-white/10">
            <tbody>
              <tr>
                <td className="py-0.5 text-left">
                  <div className="group/create flex items-center gap-2">
                    <span className="shrink-0 text-gray-400">0.</span>
                    <input
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreate()}
                      placeholder="카테고리 추가"
                      className="nes-input is-dark min-w-0 flex-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleCreate}
                      className="nes-btn shrink-0 border-[#4f8fd6] bg-[#4f8fd6] px-3 py-1 text-sm text-white opacity-0 transition-opacity hover:brightness-125 group-focus-within/create:opacity-100"
                    >
                      추가
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="nes-table is-dark is-bordered w-full text-sm [&_td]:border-white/10">
              <tbody>{leftRows.map(renderRow)}</tbody>
            </table>
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <table className="nes-table is-dark is-bordered w-full text-sm [&_td]:border-white/10">
              <tbody>{rightRows.map(renderRow)}</tbody>
            </table>
          </div>
        </div>
      </div>
      {/* 커서를 따라다니는 드래그 미리보기 — 손잡이만 흐려지는 것만으론 뭔가 잡혔다는 느낌이 안 나서 추가. */}
      <DragOverlay>
        {draggedCategory && (
          <div className="nes-container is-dark w-max !bg-violet-950 px-3 py-1.5 text-xs whitespace-nowrap text-white shadow-lg">
            ⠿ {draggedCategory.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
