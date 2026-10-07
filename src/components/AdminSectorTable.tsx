import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { SectorItem } from '@/types/api'
import { useCreateSector, useRenameSector, useReparentSector } from '@/hooks/useMarketMapCustom'
import { useSectorDeleteFlow } from '@/hooks/useSectorDeleteFlow'
import { halfOverlapCollisionDetection } from '@/utils/dndCollision'
import { charTier } from '@/utils/koreanSort'
import { toCount } from '@/utils/format'
import { SearchBar } from '@/components/ReadOnlyHeatmapSheet'
import { CheckIcon, CloseIcon, CollapseAllIcon, EditIcon, ExpandAllIcon, PlusIcon, TrashIcon } from '@/components/icons/MarketMapIcons'

interface Props {
  sectors: SectorItem[]
  settingsActionsTarget?: HTMLElement | null
}

// 루트 섹터를 몇 개 컬럼으로 나눠서 나란히 보여줄지 — 전체펼치기 시 한 컬럼이 과도하게
// 길어지는 걸 줄이기 위해 나눈다.
const ROOT_COLUMN_COUNT = 1

// 섹터 깊이 상한(최상위=0) — 4단계(0~3)까지만 허용하고 5단계 섹터는 만들지 못하게 한다. 나중에 한 단계 더
// 늘릴 때는 이 값만 바꾸면 추가 버튼과 드래그 이동 제한이 같이 따라간다.
const MAX_SECTOR_DEPTH = 3
const MAX_SECTOR_LEVELS = MAX_SECTOR_DEPTH + 1

// 섹터 이름 글자 수 상한(공백 포함) — 대/중/소분류 구분 없이 통일한다. 이미 이 길이를 넘는 이름은 그대로
// 표시되고, 이름을 고칠 때만 제한이 걸린다.
const MAX_SECTOR_NAME_LENGTH = 12

// 상단바 우측 아이콘(NavBarPageActions)과 같은 모양 — 회색 아이콘, hover 때 강조색.
const ICON_BUTTON_CLASS =
  'flex h-7 w-7 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-gray-400 outline-none hover:text-[var(--brand)]'

type SectorSortMode = 'custom' | 'alphabetical'
type SectorOrder = Record<string, number[]>

type Row =
  | { type: 'sector'; item: SectorItem; siblingIndex: number }
  | { type: 'add-child'; parentId: number; parentPath: string[]; depth: number }

// 소분류(세부의 세부) 번호 표기용 원문자. 유니코드에 50까지만 있어서 그 이상은 괄호 표기로 대체.
const CIRCLED_NUMBERS = [
  ...Array.from({ length: 20 }, (_, i) => String.fromCodePoint(0x2460 + i)), // ①~⑳ (1~20)
  ...Array.from({ length: 15 }, (_, i) => String.fromCodePoint(0x3251 + i)), // ㉑~㉟ (21~35)
  ...Array.from({ length: 15 }, (_, i) => String.fromCodePoint(0x32b1 + i)), // ㊱~㊿ (36~50)
]
function toCircledNumber(n: number): string {
  return CIRCLED_NUMBERS[n - 1] ?? `(${n})`
}

function compareSectorName(a: SectorItem, b: SectorItem): number {
  const tierA = charTier(a.name[0] ?? '')
  const tierB = charTier(b.name[0] ?? '')
  if (tierA !== tierB) return tierA - tierB
  return a.name.localeCompare(b.name, 'ko')
}

function orderSectors(items: SectorItem[], parentId: number | null, mode: SectorSortMode, order: SectorOrder): SectorItem[] {
  if (mode === 'alphabetical') return items.sort(compareSectorName)
  const saved = order[String(parentId)] ?? []
  const rank = new Map(saved.map((id, index) => [id, index]))
  return items.sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.id - b.id)
}

function buildVisibleRows(
  sectors: SectorItem[],
  parentId: number | null,
  parentPath: string[],
  expandedIds: Set<number>,
  addingChildFor: number | null,
  sortMode: SectorSortMode,
  sectorOrder: SectorOrder,
): Row[] {
  const children = orderSectors(sectors.filter(c => c.parentId === parentId), parentId, sortMode, sectorOrder)
  const rows: Row[] = []
  children.forEach((child, index) => {
    rows.push({ type: 'sector', item: child, siblingIndex: index + 1 })
    const childPath = [...parentPath, child.name]
    // 펼침 여부와 무관하게, 세부 섹터 추가 버튼을 누른 섹터 바로 아래에 입력줄을 끼워 넣는다.
    if (addingChildFor === child.id) {
      rows.push({ type: 'add-child', parentId: child.id, parentPath: childPath, depth: child.depth + 1 })
    }
    if (expandedIds.has(child.id)) {
      rows.push(...buildVisibleRows(sectors, child.id, childPath, expandedIds, addingChildFor, sortMode, sectorOrder))
    }
  })
  return rows
}

function buildRowsForRoots(
  sectors: SectorItem[],
  roots: SectorItem[],
  expandedIds: Set<number>,
  addingChildFor: number | null,
  sortMode: SectorSortMode,
  sectorOrder: SectorOrder,
): Row[] {
  const rows: Row[] = []
  roots.forEach((root, index) => {
    rows.push({ type: 'sector', item: root, siblingIndex: index + 1 })
    const rootPath = [root.name]
    if (addingChildFor === root.id) {
      rows.push({ type: 'add-child', parentId: root.id, parentPath: rootPath, depth: root.depth + 1 })
    }
    if (expandedIds.has(root.id)) {
      rows.push(...buildVisibleRows(sectors, root.id, rootPath, expandedIds, addingChildFor, sortMode, sectorOrder))
    }
  })
  return rows
}

function DraggableSectorHandle({
  sectorId,
  parentId,
  enabled,
}: {
  sectorId: number
  parentId: number | null
  enabled: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sector-drag-${sectorId}`,
    data: { sectorId, parentId },
    disabled: !enabled,
  })
  return <button ref={setNodeRef} {...listeners} {...attributes} type="button" disabled={!enabled} aria-label="업종 순서 이동" title={enabled ? '드래그해 순서 이동' : '사용자 지정 정렬에서 순서를 이동할 수 있습니다'} className={`mr-1 flex h-6 w-6 shrink-0 touch-none items-center justify-center border-0 bg-transparent text-gray-400 hover:text-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40 ${isDragging ? 'opacity-30' : ''}`}><span aria-hidden="true" className="text-base leading-none">⠿</span></button>
}

// 다른 섹터가 이 섹터 위로 드롭되면 그 자식으로 재배정되는 드롭존. 행 전체를 감싼다.
function DroppableSectorRow({
  sectorId,
  className,
  children,
}: {
  sectorId: number
  className: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `sector-drop-${sectorId}`,
    data: { sectorId },
  })
  return (
    <tr ref={setNodeRef} className={`${className} ${isOver ? 'bg-[var(--brand)]/15' : ''}`}>
      {children}
    </tr>
  )
}

export default function AdminSectorTable({ sectors, settingsActionsTarget }: Props) {
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<SectorSortMode>(() => localStorage.getItem('marketry:custom-sector-sort-mode') === 'custom' ? 'custom' : 'alphabetical')
  const [sectorOrder, setSectorOrder] = useState<SectorOrder>(() => {
    try { return JSON.parse(localStorage.getItem('marketry:custom-sector-order') ?? '{}') as SectorOrder } catch { return {} }
  })
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [newName, setNewName] = useState('')
  const [childNameByParent, setChildNameByParent] = useState<Record<number, string>>({})
  // 펼침과 무관하게 "지금 이 섹터 밑에 추가 입력줄을 보여줄지"만 따로 관리 — 한 번에 하나만 연다.
  const [addingChildFor, setAddingChildFor] = useState<number | null>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [movingSectorId, setMovingSectorId] = useState<number | null>(null)
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const [isDraggingSector, setIsDraggingSector] = useState(false)
  const [draggedSector, setDraggedSector] = useState<SectorItem | null>(null)

  const createSector = useCreateSector()
  const renameSector = useRenameSector()
  const { remove } = useSectorDeleteFlow()
  const reparentSector = useReparentSector()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const hasChildren = (id: number) => sectors.some(c => c.parentId === id)

  const isDescendant = (sector: SectorItem, ancestorId: number): boolean => {
    let current: SectorItem | undefined = sector
    while (current && current.parentId !== null) {
      if (current.parentId === ancestorId) return true
      const parentId: number = current.parentId
      current = sectors.find(c => c.id === parentId)
    }
    return false
  }

  const getMoveCandidates = (moved: SectorItem) => {
    const subtreeHeight = sectors
      .filter(c => c.depth > moved.depth && isDescendant(c, moved.id))
      .reduce((max, c) => Math.max(max, c.depth - moved.depth), 0)
    return sectors.filter(candidate =>
      candidate.id !== moved.id &&
      !isDescendant(candidate, moved.id) &&
      candidate.id !== moved.parentId &&
      candidate.depth + 1 + subtreeHeight <= MAX_SECTOR_DEPTH,
    )
  }

  const getSectorPath = (sector: SectorItem) => {
    const path = [sector.name]
    let current = sector
    while (current.parentId !== null) {
      const parent = sectors.find(item => item.id === current.parentId)
      if (!parent) break
      path.unshift(parent.name)
      current = parent
    }
    return path.join(' › ')
  }

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExpandAll = () => setExpandedIds(new Set(sectors.filter(c => hasChildren(c.id)).map(c => c.id)))
  const handleCollapseAll = () => setExpandedIds(new Set())

  const updateSiblingOrder = (parentId: number | null, nextSiblings: SectorItem[]) => {
    setSectorOrder(previous => {
      const next = { ...previous, [String(parentId)]: nextSiblings.map(item => item.id) }
      localStorage.setItem('marketry:custom-sector-order', JSON.stringify(next))
      return next
    })
  }

  const changeSortMode = (mode: SectorSortMode) => {
    setSortMode(mode)
    localStorage.setItem('marketry:custom-sector-sort-mode', mode)
  }

  const toggleAddChild = (id: number) => {
    const parent = sectors.find(c => c.id === id)
    if (parent && parent.depth >= MAX_SECTOR_DEPTH) {
      window.alert(`업종은 ${MAX_SECTOR_LEVELS}단계까지만 만들 수 있습니다.`)
      return
    }
    setAddingChildFor(prev => (prev === id ? null : id))
  }

  const triggerHighlight = (id: number) => {
    setHighlightedId(id)
    setTimeout(() => setHighlightedId(current => (current === id ? null : current)), 2000)
  }

  const handleCreate = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    createSector.mutate({ name: trimmed, parentId: null }, { onSuccess: created => triggerHighlight(created.id) })
    setNewName('')
  }

  const handleCreateChild = (parentId: number) => {
    const parent = sectors.find(c => c.id === parentId)
    if (parent && parent.depth >= MAX_SECTOR_DEPTH) return
    const trimmed = (childNameByParent[parentId] ?? '').trim()
    if (!trimmed) return
    createSector.mutate({ name: trimmed, parentId }, { onSuccess: created => triggerHighlight(created.id) })
    setChildNameByParent(prev => ({ ...prev, [parentId]: '' }))
  }

  const startRename = (sector: SectorItem) => {
    setRenamingId(sector.id)
    setRenameValue(sector.name)
  }

  const cancelRename = () => setRenamingId(null)

  const submitRename = (sector: SectorItem) => {
    const trimmed = renameValue.trim()
    setRenamingId(null)
    if (!trimmed || trimmed === sector.name) return
    renameSector.mutate({ id: sector.id, name: trimmed }, { onSuccess: () => triggerHighlight(sector.id) })
  }

  // 검색 중에는 이름이 맞는 섹터와 그 조상만 남기고 전부 펼쳐서 보여준다(KRX 시트의 검색과 같은 느낌).
  const trimmedQuery = query.trim()
  const viewSectors = useMemo(() => {
    if (!trimmedQuery) return sectors
    const keep = new Set<number>()
    const byId = new Map(sectors.map(c => [c.id, c]))
    for (const sector of sectors) {
      if (!sector.name.includes(trimmedQuery)) continue
      let current: SectorItem | undefined = sector
      while (current && !keep.has(current.id)) {
        keep.add(current.id)
        current = current.parentId === null ? undefined : byId.get(current.parentId)
      }
    }
    return sectors.filter(c => keep.has(c.id))
  }, [sectors, trimmedQuery])
  const sectorCounts = useMemo(() => ({
    major: viewSectors.filter(sector => sector.depth === 0).length,
    middle: viewSectors.filter(sector => sector.depth === 1).length,
    // 3단계 이하의 세부 업종도 소분류에 포함해 전체 개수가 항상 합산되게 한다.
    small: viewSectors.filter(sector => sector.depth >= 2).length,
  }), [viewSectors])
  const viewExpandedIds = useMemo(
    () => (trimmedQuery ? new Set(viewSectors.filter(c => viewSectors.some(x => x.parentId === c.id)).map(c => c.id)) : expandedIds),
    [trimmedQuery, viewSectors, expandedIds],
  )

  const rootSectors = orderSectors(viewSectors.filter(c => c.parentId === null), null, sortMode, sectorOrder)
  const columnSize = Math.ceil(rootSectors.length / ROOT_COLUMN_COUNT)
  const columnRoots = Array.from({ length: ROOT_COLUMN_COUNT }, (_, i) =>
    rootSectors.slice(i * columnSize, (i + 1) * columnSize),
  )
  const columnRows = columnRoots.map(roots => buildRowsForRoots(viewSectors, roots, viewExpandedIds, addingChildFor, sortMode, sectorOrder))

  const rootIndexById = new Map<number, number>()
  rootSectors.forEach((c, i) => rootIndexById.set(c.id, i + 1))

  const renderRow = (row: Row) => {
    if (row.type === 'add-child') {
      const parentId = row.parentId
      const quotedChain = row.parentPath.map(name => `'${name}'`).join(' - ')
      return (
        <tr key={`add-child-${parentId}`}>
          <td className="py-0.5 text-left" style={{ paddingLeft: `${row.depth * 20 + 8}px` }}>
            <div className="group/create flex items-center gap-2">
              <span className="shrink-0 text-gray-400">-</span>
              <input
                type="text"
                maxLength={MAX_SECTOR_NAME_LENGTH}
                autoFocus
                value={childNameByParent[parentId] ?? ''}
                onChange={e => setChildNameByParent(prev => ({ ...prev, [parentId]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateChild(parentId)
                  if (e.key === 'Escape') setAddingChildFor(null)
                }}
                placeholder="추가"
                title={`${quotedChain} 업종 내 세부항목 추가`}
                aria-label={`${quotedChain} 업종 내 세부항목 이름`}
                className="h-7 w-40 rounded-md border-0 bg-[#3b3b3b] px-2 text-sm font-medium text-white outline-none placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-[var(--brand)]"
              />
              <button
                type="button"
                aria-label="추가"
                title="추가"
                onClick={() => handleCreateChild(parentId)}
                className={ICON_BUTTON_CLASS}
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
      )
    }

    const sector = row.item
    const isRoot = sector.parentId === null
    const expandable = isRoot || hasChildren(sector.id)
    const label = isRoot
      ? `${rootIndexById.get(sector.id)}. ${sector.name}`
      : sector.depth === 2
        ? `${toCircledNumber(row.siblingIndex)} ${sector.name}`
        : sector.depth >= 3
          ? `(${row.siblingIndex}) ${sector.name}`
          : `${row.siblingIndex}) ${sector.name}`
    const isRenaming = renamingId === sector.id
    return (
      <DroppableSectorRow
        key={sector.id}
        sectorId={sector.id}
        className={`group ${highlightedId === sector.id ? 'animate-row-blink' : ''}`}
      >
        <td className="py-0.5 text-left" style={{ paddingLeft: `${sector.depth * 20 + 8}px` }}>
          <div className="flex items-center gap-6">
            <div className={`flex items-center ${isRenaming ? 'min-w-0 flex-1' : ''}`}>
              <DraggableSectorHandle sectorId={sector.id} parentId={sector.parentId} enabled={sortMode === 'custom'} />
              {isRenaming ? (
                <input
                  type="text"
                  maxLength={MAX_SECTOR_NAME_LENGTH}
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitRename(sector)
                    if (e.key === 'Escape') cancelRename()
                  }}
                  className="nes-input is-dark min-w-0 flex-1 text-sm"
                />
              ) : (
                <button type="button" onClick={() => expandable && toggleExpand(sector.id)} aria-expanded={expandable ? expandedIds.has(sector.id) : undefined} className="truncate border-0 bg-transparent p-0 text-left tabular-nums text-white hover:text-[var(--brand)]">{label}</button>
              )}
            </div>
            <div
              className={`flex shrink-0 items-center gap-1 ${isRenaming ? '' : 'opacity-0 transition-opacity group-hover:opacity-100'}`}
            >
              {isRenaming ? (
                <>
                  <button type="button" aria-label="변경 확인" title="확인" onClick={() => submitRename(sector)} className={ICON_BUTTON_CLASS}>
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="변경 취소" title="취소" onClick={cancelRename} className={ICON_BUTTON_CLASS}>
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  {movingSectorId === sector.id ? (
                    <>
                      <select
                        autoFocus
                        aria-label={`${sector.name}의 상위 업종 선택`}
                        defaultValue=""
                        onChange={event => {
                          const value = event.target.value
                          if (value === '') return
                          const parentId = value === '__root__' ? null : Number(value)
                          reparentSector.mutate({ id: sector.id, parentId }, { onSuccess: () => setMovingSectorId(null) })
                        }}
                        onKeyDown={event => event.key === 'Escape' && setMovingSectorId(null)}
                        className="h-7 max-w-40 rounded border border-gray-600 bg-zinc-800 px-1 text-xs text-white"
                      >
                        <option value="" disabled>상위 업종 선택</option>
                        {sector.parentId !== null && <option value="__root__">최상위로 이동</option>}
                        {getMoveCandidates(sector).map(candidate => (
                          <option key={candidate.id} value={candidate.id}>{getSectorPath(candidate)}</option>
                        ))}
                      </select>
                      <button type="button" aria-label="상위 업종 선택 취소" title="취소" onClick={() => setMovingSectorId(null)} className={ICON_BUTTON_CLASS}>
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <button type="button" aria-label="상위 업종 변경" title="다른 업종 안으로 이동" onClick={() => setMovingSectorId(sector.id)} className={ICON_BUTTON_CLASS}>
                      <span aria-hidden="true" className="text-base leading-none">↪</span>
                    </button>
                  )}
                  {sector.depth < MAX_SECTOR_DEPTH ? (
                    <button type="button" aria-label="세부 업종 추가" title="추가" onClick={() => toggleAddChild(sector.id)} className={ICON_BUTTON_CLASS}>
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="inline-block h-7 w-7 shrink-0" aria-hidden="true" />
                  )}
                  <button type="button" aria-label="이름 변경" title="변경" onClick={() => startRename(sector)} className={ICON_BUTTON_CLASS}>
                    <EditIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="삭제"
                    title="삭제"
                    onClick={() => remove(sector.id, sector.name)}
                    className={`${ICON_BUTTON_CLASS} hover:!text-red-500`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </td>
      </DroppableSectorRow>
    )
  }

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={halfOverlapCollisionDetection}
      onDragStart={event => {
        setIsDraggingSector(true)
        const dragData = event.active.data.current as { sectorId: number } | undefined
        setDraggedSector(dragData ? (sectors.find(c => c.id === dragData.sectorId) ?? null) : null)
      }}
      onDragEnd={event => {
        setIsDraggingSector(false)
        setDraggedSector(null)
        const draggedData = event.active.data.current as { sectorId: number; parentId: number | null } | undefined
        const targetData = event.over?.data.current as { sectorId: number } | undefined
        const draggedItem = draggedData && sectors.find(item => item.id === draggedData.sectorId)
        const targetItem = targetData && sectors.find(item => item.id === targetData.sectorId)
        if (sortMode === 'custom' && draggedItem && targetItem && draggedItem.parentId === targetItem.parentId && draggedItem.id !== targetItem.id) {
          const siblings = orderSectors(sectors.filter(item => item.parentId === draggedItem.parentId), draggedItem.parentId, sortMode, sectorOrder)
          const fromIndex = siblings.findIndex(item => item.id === draggedItem.id)
          const targetIndex = siblings.findIndex(item => item.id === targetItem.id)
          const activeRect = event.active.rect.current.translated
          const overRect = event.over?.rect
          const insertAfter = !!activeRect && !!overRect && activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2
          const [moved] = siblings.splice(fromIndex, 1)
          const adjustedTargetIndex = targetIndex - (fromIndex < targetIndex ? 1 : 0)
          siblings.splice(Math.max(0, adjustedTargetIndex + (insertAfter ? 1 : 0)), 0, moved)
          updateSiblingOrder(draggedItem.parentId, siblings)
        }
      }}
      onDragCancel={() => {
        setIsDraggingSector(false)
        setDraggedSector(null)
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <SearchBar
          query={query}
          onChange={setQuery}
          placeholder="업종 검색"
          ariaLabel="업종 검색"
          countLabel={`대분류 ${toCount(sectorCounts.major)} · 중분류 ${toCount(sectorCounts.middle)} · 소분류 ${toCount(sectorCounts.small)}`}
        />
        {isDraggingSector && (
          <p className="px-2 py-2 text-sm text-[var(--brand)]">같은 단계의 업종 사이에 놓아 순서를 바꿉니다</p>
        )}
        <div className="grid min-h-0 flex-1 grid-cols-1">
          {columnRows.map((rows, columnIndex) => (
            <div key={columnIndex} className="h-full overflow-auto scrollbar-hide">
              <table className="nes-table is-dark custom-page-table custom-sector-table h-full w-full text-sm [&_td]:border-white/10">
                <tbody>
                  {rows.map(renderRow)}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
      {/* 커서를 따라다니는 드래그 미리보기 — 손잡이만 흐려지는 것만으론 뭔가 잡혔다는 느낌이 안 나서 추가. */}
      <DragOverlay>
        {draggedSector && (
          <div className="nes-container is-dark w-max !bg-violet-950 px-3 py-1.5 text-xs whitespace-nowrap text-white shadow-lg">
            ⠿ {draggedSector.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
    {settingsActionsTarget && createPortal(
      <section aria-label="업종 관리" className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-white">업종 관리</h2>
        <p className="mb-2 text-xs text-gray-400">항목 정렬</p>
        <div role="radiogroup" aria-label="업종 항목 정렬" className="mb-3 grid grid-cols-2 rounded-md border border-gray-600 bg-zinc-700 p-0.5">
          {([['custom', '사용자 지정'], ['alphabetical', '가나다순']] as const).map(([mode, label]) => (
            <button key={mode} type="button" role="radio" aria-checked={sortMode === mode} onClick={() => changeSortMode(mode)} className={`min-h-8 rounded px-1 text-xs font-medium ${sortMode === mode ? 'border-2 border-[#171717] bg-gray-300 text-black' : 'border-0 bg-transparent text-gray-300 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={handleExpandAll} className="flex h-9 items-center justify-center gap-1 rounded-md border-2 border-[#171717] bg-gray-300 text-xs font-medium text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:bg-gray-200">
            <ExpandAllIcon className="h-4 w-4" /> 전체 펼치기
          </button>
          <button type="button" onClick={handleCollapseAll} className="flex h-9 items-center justify-center gap-1 rounded-md border-2 border-[#171717] bg-gray-300 text-xs font-medium text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:bg-gray-200">
            <CollapseAllIcon className="h-4 w-4" /> 전체 접기
          </button>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <input
            type="text"
            maxLength={MAX_SECTOR_NAME_LENGTH}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="업종 추가"
            aria-label="최상위 업종 이름"
            className="h-9 min-w-0 flex-1 rounded-md border border-gray-600 bg-[#3b3b3b] px-2 text-sm text-white outline-none placeholder:text-gray-400 focus:border-[var(--brand)]"
          />
          <button type="button" aria-label="업종 추가" title="업종 추가" onClick={handleCreate} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-[#171717] bg-gray-300 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:bg-gray-200">
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </section>,
      settingsActionsTarget,
    )}
    </>
  )
}
