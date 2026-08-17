import { useState } from 'react'
import type { CategoryItem } from '@/types/api'
import { useCreateCategory, useRenameCategory } from '@/hooks/useMarketMapAdmin'
import { useCategoryDeleteFlow } from '@/hooks/useCategoryDeleteFlow'

interface Props {
  categories: CategoryItem[]
}

type Row = { type: 'category'; item: CategoryItem } | { type: 'add-child'; parentId: number; parentName: string; depth: number }

// 이름순 정렬하되 "미분류"는 항상 맨 뒤로.
function compareCategoryName(a: CategoryItem, b: CategoryItem): number {
  if (a.name === '미분류') return 1
  if (b.name === '미분류') return -1
  return a.name.localeCompare(b.name, 'ko')
}

function buildVisibleRows(categories: CategoryItem[], parentId: number | null, expandedIds: Set<number>): Row[] {
  const children = categories.filter(c => c.parentId === parentId).sort(compareCategoryName)
  const rows: Row[] = []
  for (const child of children) {
    rows.push({ type: 'category', item: child })
    if (expandedIds.has(child.id)) {
      rows.push({ type: 'add-child', parentId: child.id, parentName: child.name, depth: child.depth + 1 })
      rows.push(...buildVisibleRows(categories, child.id, expandedIds))
    }
  }
  return rows
}

function buildRowsForRoots(categories: CategoryItem[], roots: CategoryItem[], expandedIds: Set<number>): Row[] {
  const rows: Row[] = []
  for (const root of roots) {
    rows.push({ type: 'category', item: root })
    if (expandedIds.has(root.id)) {
      rows.push({ type: 'add-child', parentId: root.id, parentName: root.name, depth: root.depth + 1 })
      rows.push(...buildVisibleRows(categories, root.id, expandedIds))
    }
  }
  return rows
}

export default function AdminCategoryTable({ categories }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [newName, setNewName] = useState('')
  const [childNameByParent, setChildNameByParent] = useState<Record<number, string>>({})
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [highlightedId, setHighlightedId] = useState<number | null>(null)

  const createCategory = useCreateCategory()
  const renameCategory = useRenameCategory()
  const { remove } = useCategoryDeleteFlow()

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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

  const hasChildren = (id: number) => categories.some(c => c.parentId === id)
  const childCount = (id: number) => categories.filter(c => c.parentId === id).length

  const rootCategories = categories.filter(c => c.parentId === null).sort(compareCategoryName)
  const splitIndex = Math.ceil(rootCategories.length / 2)
  const leftRoots = rootCategories.slice(0, splitIndex)
  const rightRoots = rootCategories.slice(splitIndex)
  const leftRows = buildRowsForRoots(categories, leftRoots, expandedIds)
  const rightRows = buildRowsForRoots(categories, rightRoots, expandedIds)

  const rootIndexById = new Map<number, number>()
  rootCategories.forEach((c, i) => rootIndexById.set(c.id, i + 1))

  const renderRow = (row: Row) => {
    if (row.type === 'add-child') {
      const parentId = row.parentId
      return (
        <tr key={`add-child-${parentId}`}>
          <td className="text-left" style={{ paddingLeft: `${row.depth * 20 + 8}px` }}>
            <div className="group/create flex items-center gap-2">
              <span className="shrink-0 text-gray-400">-</span>
              <input
                type="text"
                value={childNameByParent[parentId] ?? ''}
                onChange={e => setChildNameByParent(prev => ({ ...prev, [parentId]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleCreateChild(parentId)}
                placeholder={`${row.parentName} 카테고리 추가`}
                className="nes-input is-dark min-w-0 flex-1 text-xs"
              />
              <button
                type="button"
                onClick={() => handleCreateChild(parentId)}
                className="nes-btn shrink-0 border-[#4f8fd6] bg-[#4f8fd6] px-2 py-0.5 text-xs text-white opacity-0 transition-opacity hover:brightness-125 group-focus-within/create:opacity-100"
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
    const count = childCount(category.id)
    const countSuffix = count > 0 ? `(${count})` : ''
    const label = isRoot
      ? `${rootIndexById.get(category.id)}. ${category.name}${countSuffix}`
      : `- ${category.name}${countSuffix}`
    const isRenaming = renamingId === category.id
    return (
      <tr key={category.id} className={`group ${highlightedId === category.id ? 'animate-row-blink' : ''}`}>
        <td className="text-left" style={{ paddingLeft: `${category.depth * 20 + 8}px` }}>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => expandable && toggleExpand(category.id)}
              className={`flex items-center border-0 bg-transparent text-left text-white ${isRenaming ? 'min-w-0 flex-1' : ''} ${
                expandable ? 'cursor-pointer hover:text-yellow-400' : 'cursor-default'
              }`}
            >
              {expandable && (
                <span className="mr-1 inline-block w-3 shrink-0 text-gray-400">{expandedIds.has(category.id) ? '▾' : '▸'}</span>
              )}
              {isRenaming ? (
                <input
                  type="text"
                  autoFocus
                  value={renameValue}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitRename(category)
                    if (e.key === 'Escape') cancelRename()
                  }}
                  className="nes-input is-dark min-w-0 flex-1 text-xs"
                />
              ) : (
                <span className="truncate">{label}</span>
              )}
            </button>
            <div
              className={`flex shrink-0 items-center gap-3 ${isRenaming ? '' : 'opacity-0 transition-opacity group-hover:opacity-100'}`}
            >
              {isRenaming ? (
                <>
                  <button
                    type="button"
                    onClick={() => submitRename(category)}
                    className="nes-btn border-[#4f8fd6] bg-[#4f8fd6] px-2 py-0.5 text-xs text-white hover:brightness-125"
                  >
                    확인
                  </button>
                  <button
                    type="button"
                    onClick={cancelRename}
                    className="nes-btn border-gray-600 bg-black px-2 py-0.5 text-xs text-white hover:bg-gray-800"
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startRename(category)}
                    className="nes-btn border-[#4f8fd6] bg-[#4f8fd6] px-2 py-0.5 text-xs text-white hover:brightness-125"
                  >
                    변경
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(category.id, category.name)}
                    className="nes-btn border-red-600 bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700"
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div>
      <p className="mb-2 px-2 text-sm font-bold text-white">카테고리 목록</p>
      <div className="mb-4 overflow-x-auto scrollbar-hide">
        <table className="nes-table is-dark is-bordered w-full text-xs">
          <tbody>
            <tr>
              <td className="text-left">
                <div className="group/create flex items-center gap-2">
                  <span className="shrink-0 text-gray-400">0.</span>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="카테고리 추가"
                    className="nes-input is-dark min-w-0 flex-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="nes-btn shrink-0 border-[#4f8fd6] bg-[#4f8fd6] px-2 py-0.5 text-xs text-white opacity-0 transition-opacity hover:brightness-125 group-focus-within/create:opacity-100"
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
          <table className="nes-table is-dark is-bordered w-full text-xs">
            <tbody>{leftRows.map(renderRow)}</tbody>
          </table>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="nes-table is-dark is-bordered w-full text-xs">
            <tbody>{rightRows.map(renderRow)}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
