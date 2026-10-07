import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { SectorItem } from '@/types/api'
import { useCreateSector, useRenameSector, useReparentSector } from '@/hooks/useMarketMapCustom'
import { useSectorDeleteFlow } from '@/hooks/useSectorDeleteFlow'
import { halfOverlapCollisionDetection } from '@/utils/dndCollision'
import { toCount } from '@/utils/format'
import { appAlert } from '@/utils/appDialogBus'
import { SearchBar } from '@/components/ReadOnlyHeatmapSheet'
import { CheckIcon, CloseIcon, EditIcon, PlusIcon, TrashIcon } from '@/components/icons/MarketMapIcons'

interface Props {
  sectors: SectorItem[]
  settingsActionsTarget?: HTMLElement | null
}

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

type SectorOrder = Record<string, number[]>

type Row =
  | { type: 'sector'; item: SectorItem; siblingIndex: number }
  | { type: 'add-child'; parentId: number; parentPath: string[]; depth: number }

function orderSectors(items: SectorItem[], parentId: number | null, order: SectorOrder): SectorItem[] {
  const saved = order[String(parentId)] ?? []
  const rank = new Map(saved.map((id, index) => [id, index]))
  return items.sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.id - b.id)
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
  const { setNodeRef } = useDroppable({
    id: `sector-drop-${sectorId}`,
    data: { sectorId },
  })
  return (
    <tr ref={setNodeRef} className={className}>
      {children}
    </tr>
  )
}

export default function AdminSectorTable({ sectors, settingsActionsTarget }: Props) {
  const [query, setQuery] = useState('')
  const [sectorOrder, setSectorOrder] = useState<SectorOrder>(() => {
    try { return JSON.parse(localStorage.getItem('marketry:custom-sector-order') ?? '{}') as SectorOrder } catch { return {} }
  })
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null)
  const [selectedMiddleId, setSelectedMiddleId] = useState<number | null>(null)
  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{ sectorId: number; position: 'before' | 'after' } | null>(null)
  const [newName, setNewName] = useState('')
  const [childNameByParent, setChildNameByParent] = useState<Record<number, string>>({})
  // 펼침과 무관하게 "지금 이 섹터 밑에 추가 입력줄을 보여줄지"만 따로 관리 — 한 번에 하나만 연다.
  const [addingChildFor, setAddingChildFor] = useState<number | null>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [movingSectorId, setMovingSectorId] = useState<number | null>(null)
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
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

  const updateSiblingOrder = (parentId: number | null, nextSiblings: SectorItem[]) => {
    setSectorOrder(previous => {
      const next = { ...previous, [String(parentId)]: nextSiblings.map(item => item.id) }
      localStorage.setItem('marketry:custom-sector-order', JSON.stringify(next))
      return next
    })
  }

  const toggleAddChild = (id: number) => {
    const parent = sectors.find(c => c.id === id)
    if (parent && parent.depth >= MAX_SECTOR_DEPTH) {
      appAlert(`업종은 ${MAX_SECTOR_LEVELS}단계까지만 만들 수 있습니다.`)
      return
    }
    if (parent?.depth === 0) { setSelectedMajorId(id); setSelectedMiddleId(null) }
    if (parent?.depth === 1) setSelectedMiddleId(id)
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
  const rootSectors = orderSectors(viewSectors.filter(c => c.parentId === null), null, sectorOrder)
  const middleSectors = selectedMajorId === null ? [] : orderSectors(viewSectors.filter(c => c.parentId === selectedMajorId), selectedMajorId, sectorOrder)
  const smallSectors = selectedMiddleId === null ? [] : orderSectors(viewSectors.filter(c => c.parentId === selectedMiddleId), selectedMiddleId, sectorOrder)
  const makeRows = (items: SectorItem[], parentId: number | null): Row[] => {
    const rows: Row[] = items.map((item, index) => ({ type: 'sector', item, siblingIndex: index + 1 }))
    if (parentId !== null && addingChildFor === parentId) {
      const parent = sectors.find(item => item.id === parentId)
      if (parent) rows.push({ type: 'add-child', parentId, parentPath: getSectorPath(parent).split(' › '), depth: parent.depth + 1 })
    }
    return rows
  }
  const columnRows = [makeRows(rootSectors, null), makeRows(middleSectors, selectedMajorId), makeRows(smallSectors, selectedMiddleId)]
  const selectedSector = sectors.find(item => item.id === selectedSectorId) ?? null

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
    const itemNumber = isRoot
      ? `${rootIndexById.get(sector.id) ?? row.siblingIndex}`
      : sector.depth >= 2
        ? `(${row.siblingIndex})`
        : `${row.siblingIndex})`
    const isRenaming = renamingId === sector.id
    return (
      <DroppableSectorRow
        key={sector.id}
        sectorId={sector.id}
        className={`group ${highlightedId === sector.id ? 'animate-row-blink' : ''}`}
      >
        <td className="relative py-0.5 text-left" style={{ paddingLeft: `${sector.depth * 20 + 8}px` }}>
          {dropIndicator?.sectorId === sector.id && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 z-10 h-[2px] bg-[var(--brand)] ${dropIndicator.position === 'before' ? 'top-0' : 'bottom-0'}`}
            />
          )}
          <div className="flex items-center gap-2">
            <div className={`flex items-center ${isRenaming ? 'min-w-0 flex-1' : ''}`}>
              <DraggableSectorHandle sectorId={sector.id} parentId={sector.parentId} enabled />
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
                <>
                  <span aria-hidden="true" className="mr-2 inline-flex h-5 w-7 shrink-0 items-center justify-center rounded-sm border border-gray-400 bg-white text-[16px] leading-none font-bold text-gray-500 tabular-nums">
                    {itemNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSectorId(sector.id)
                      if (sector.depth === 0) { setSelectedMajorId(current => current === sector.id ? null : sector.id); setSelectedMiddleId(null) }
                      if (sector.depth === 1) setSelectedMiddleId(current => current === sector.id ? null : sector.id)
                    }}
                    aria-expanded={expandable ? (sector.depth === 0 ? selectedMajorId === sector.id : selectedMiddleId === sector.id) : undefined}
                    className={`truncate border-0 bg-transparent p-0 text-left text-[16px] hover:text-[var(--brand)] ${selectedSectorId === sector.id ? 'text-[var(--brand)]' : 'text-white'}`}
                  >
                    {sector.name}
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
      onDragOver={event => {
        const draggedData = event.active.data.current as { sectorId: number; parentId: number | null } | undefined
        const targetData = event.over?.data.current as { sectorId: number } | undefined
        const draggedItem = draggedData && sectors.find(item => item.id === draggedData.sectorId)
        const targetItem = targetData && sectors.find(item => item.id === targetData.sectorId)
        const activeRect = event.active.rect.current.translated
        const overRect = event.over?.rect
        if (draggedItem && targetItem && draggedItem.parentId === targetItem.parentId && draggedItem.id !== targetItem.id && activeRect && overRect) {
          const insertAfter = activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2
          setDropIndicator({ sectorId: targetItem.id, position: insertAfter ? 'after' : 'before' })
        } else {
          setDropIndicator(null)
        }
      }}
      onDragStart={event => {
        setDropIndicator(null)
        const dragData = event.active.data.current as { sectorId: number } | undefined
        setDraggedSector(dragData ? (sectors.find(c => c.id === dragData.sectorId) ?? null) : null)
      }}
      onDragEnd={event => {
        setDropIndicator(null)
        setDraggedSector(null)
        const draggedData = event.active.data.current as { sectorId: number; parentId: number | null } | undefined
        const targetData = event.over?.data.current as { sectorId: number } | undefined
        const draggedItem = draggedData && sectors.find(item => item.id === draggedData.sectorId)
        const targetItem = targetData && sectors.find(item => item.id === targetData.sectorId)
        if (draggedItem && targetItem && draggedItem.parentId === targetItem.parentId && draggedItem.id !== targetItem.id) {
          const siblings = orderSectors(sectors.filter(item => item.parentId === draggedItem.parentId), draggedItem.parentId, sectorOrder)
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
        setDropIndicator(null)
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
        <div className="grid min-h-0 flex-1 grid-cols-3 overflow-hidden border-t border-white/10">
          {(['대분류', '중분류', '소분류'] as const).map((label, index) => (
            <div key={label} className={`flex min-h-0 min-w-0 flex-col ${index < 2 ? 'border-r border-white/15' : ''}`}>
              <div className={`flex h-10 shrink-0 items-center justify-center gap-2 border-b border-white/10 bg-[#2b3a4f] text-sm font-bold ${index === (selectedMiddleId !== null ? 2 : selectedMajorId !== null ? 1 : 0) ? 'text-[var(--brand)]' : 'text-slate-100'}`}>
                {label}
                {index === (selectedMiddleId !== null ? 2 : selectedMajorId !== null ? 1 : 0) && <span aria-hidden="true" className="text-[var(--brand)]">⌃</span>}
              </div>
              <div className="min-h-0 flex-1 overflow-auto scrollbar-hide">
                <table className="nes-table is-dark custom-page-table custom-sector-table w-full text-sm [&_td]:border-white/10"><tbody>{columnRows[index].map(renderRow)}</tbody></table>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* 커서를 따라다니는 드래그 미리보기 — 손잡이만 흐려지는 것만으론 뭔가 잡혔다는 느낌이 안 나서 추가. */}
      <DragOverlay>
        {draggedSector && (
          <div className="w-max bg-transparent px-2 py-1.5 text-[16px] whitespace-nowrap text-white">
            ⠿ {draggedSector.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
    {settingsActionsTarget && createPortal(
      <section aria-label="업종 관리" className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-white">업종 관리</h2>
        {selectedSector && <div className="mb-3 rounded-md border border-white/15 bg-black/20 p-2 text-sm text-white">
          <div className="mb-2 truncate font-medium">{getSectorPath(selectedSector)}</div>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" title="다른 업종 안으로 이동" onClick={() => setMovingSectorId(selectedSector.id)} className={ICON_BUTTON_CLASS}><span aria-hidden="true" className="text-base leading-none">↪</span></button>
            {movingSectorId === selectedSector.id && <select autoFocus aria-label={`${selectedSector.name}의 상위 업종 선택`} defaultValue="" onChange={event => { const value = event.target.value; if (value === '') return; const parentId = value === '__root__' ? null : Number(value); reparentSector.mutate({ id: selectedSector.id, parentId }, { onSuccess: () => setMovingSectorId(null) }) }} onKeyDown={event => event.key === 'Escape' && setMovingSectorId(null)} className="h-7 max-w-40 rounded border border-gray-600 bg-zinc-800 px-1 text-xs text-white"><option value="" disabled>상위 업종 선택</option>{selectedSector.parentId !== null && <option value="__root__">최상위로 이동</option>}{getMoveCandidates(selectedSector).map(candidate => <option key={candidate.id} value={candidate.id}>{getSectorPath(candidate)}</option>)}</select>}
            {selectedSector.depth < MAX_SECTOR_DEPTH && <button type="button" title="세부 업종 추가" onClick={() => toggleAddChild(selectedSector.id)} className={ICON_BUTTON_CLASS}><PlusIcon className="h-4 w-4" /></button>}
            <button type="button" title="이름 변경" onClick={() => startRename(selectedSector)} className={ICON_BUTTON_CLASS}><EditIcon className="h-4 w-4" /></button>
            <button type="button" title="삭제" onClick={() => remove(selectedSector.id, selectedSector.name)} className={`${ICON_BUTTON_CLASS} hover:!text-red-500`}><TrashIcon className="h-4 w-4" /></button>
          </div>
          {renamingId === selectedSector.id && <div className="mt-2 flex gap-1"><input autoFocus value={renameValue} maxLength={MAX_SECTOR_NAME_LENGTH} onChange={event => setRenameValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') submitRename(selectedSector); if (event.key === 'Escape') cancelRename() }} className="h-7 min-w-0 flex-1 rounded bg-zinc-800 px-2 text-sm text-white"/><button type="button" title="확인" onClick={() => submitRename(selectedSector)} className={ICON_BUTTON_CLASS}><CheckIcon className="h-4 w-4"/></button><button type="button" title="취소" onClick={cancelRename} className={ICON_BUTTON_CLASS}><CloseIcon className="h-4 w-4"/></button></div>}
        </div>}
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
