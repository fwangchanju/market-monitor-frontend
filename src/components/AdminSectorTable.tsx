import { useEffect, useMemo, useState } from 'react'
import { useReportCountLabel } from '@/hooks/useReportCountLabel'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { SectorItem } from '@/types/api'
import { useCreateSector, useRenameSector, useReparentSector } from '@/hooks/useMarketMapCustom'
import { useSectorDeleteFlow } from '@/hooks/useSectorDeleteFlow'
import { halfOverlapCollisionDetection } from '@/utils/dndCollision'
import { toCount } from '@/utils/format'
import { appAlert, appConfirm } from '@/utils/appDialogBus'
import { SearchBar } from '@/components/ReadOnlyTaxonomySheet'
import EmptyMessage, { EMPTY_DATA_MESSAGE, EMPTY_SEARCH_MESSAGE } from '@/components/EmptyMessage'
import { EditIcon, PlusIcon, TrashIcon } from '@/components/icons/MarketMapIcons'

interface Props {
  sectors: SectorItem[]
  settingsActionsTarget?: HTMLElement | null
  // 검색창 옆에 두던 개수를 받아 갈 곳 — 페이지가 설정창 머리글에 그려 준다.
  onCountLabelChange?: (label: string | undefined) => void
}

// 섹터 깊이 상한(최상위=0) — 4단계(0~3)까지만 허용하고 5단계 섹터는 만들지 못하게 한다. 나중에 한 단계 더
// 늘릴 때는 이 값만 바꾸면 추가 버튼과 드래그 이동 제한이 같이 따라간다.
const MAX_SECTOR_DEPTH = 3

// 신규 종목이 자동 배정되는 최상위 업종 — 삭제할 수 없다(서버도 막는다).
const NEW_LISTING_SECTOR_NAME = '신규 상장'
const NEW_LISTING_DELETE_MESSAGE = '신규 상장시 자동 분류되는 항목이라 삭제가 불가능합니다.'
const isProtectedSector = (sector: SectorItem) => sector.parentId === null && sector.name === NEW_LISTING_SECTOR_NAME
const MAX_SECTOR_LEVELS = MAX_SECTOR_DEPTH + 1
// "세부 업종 추가" 아이콘은 대분류·중분류(깊이 0·1)에만 보여 준다 — 소분류 이하에는 더 만들지 않는다. 이미 있는 4단계 업종은 그대로 둔다.
const ADD_CHILD_MAX_PARENT_DEPTH = 1

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
  return <button ref={setNodeRef} {...listeners} {...attributes} data-no-row-select type="button" disabled={!enabled} aria-label="업종 순서 이동" title={enabled ? '드래그해 순서 이동' : '사용자 지정 정렬에서 순서를 이동할 수 있습니다'} className={`mr-1 flex h-6 w-6 shrink-0 touch-none items-center justify-center border-0 bg-transparent text-gray-400 hover:text-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40 ${isDragging ? 'opacity-30' : ''}`}><span aria-hidden="true" className="text-xl leading-none">⠿</span></button>
}

// 다른 섹터가 이 섹터 위로 드롭되면 그 자식으로 재배정되는 드롭존. 행 전체를 감싼다.
function DroppableSectorRow({
  sectorId,
  className,
  onClick,
  children,
}: {
  sectorId: number
  className: string
  onClick?: React.MouseEventHandler<HTMLTableRowElement>
  children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({
    id: `sector-drop-${sectorId}`,
    data: { sectorId },
  })
  return (
    <tr ref={setNodeRef} className={className} onClick={onClick}>
      {children}
    </tr>
  )
}

export default function AdminSectorTable({ sectors, settingsActionsTarget, onCountLabelChange }: Props) {
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
  // 끌고 있는 줄의 폭과, 손잡이(끄는 대상) 기준 줄 왼쪽 끝 위치 — 미리보기를 줄 전체 폭으로, 원래 줄과 같은 왼쪽 위치에서 그린다.
  const [draggedRow, setDraggedRow] = useState<{ width: number; offsetX: number } | null>(null)

  const createSector = useCreateSector()
  const renameSector = useRenameSector()
  const { remove } = useSectorDeleteFlow()
  const reparentSector = useReparentSector()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const hasChildren = (id: number) => sectors.some(c => c.parentId === id)
  // 바로 아래 세부 항목 수 — 검색으로 일부만 보이는 중에도 실제 개수를 보여준다.
  const childCountByParent = useMemo(() => {
    const counts = new Map<number, number>()
    for (const sector of sectors) {
      if (sector.parentId !== null) counts.set(sector.parentId, (counts.get(sector.parentId) ?? 0) + 1)
    }
    return counts
  }, [sectors])

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
      // 소분류(깊이 2) 이하에는 더 넣지 않는다 — 옮긴 뒤 가장 깊은 업종도 소분류(깊이 2)를 넘지 않아야 한다.
      candidate.depth <= ADD_CHILD_MAX_PARENT_DEPTH &&
      candidate.depth + 1 + subtreeHeight <= ADD_CHILD_MAX_PARENT_DEPTH + 1,
    )
  }

  // 이동 모드 — ↪를 누르면 옮길 업종이 정해지고, 표에서 도착할 상위 업종 줄의 "여기로" 버튼을 누르면 확인 뒤 옮긴다.
  // 줄을 누르면 평소처럼 펼쳐지므로(선택 변경) 다른 가지의 업종도 찾아가서 고를 수 있다.
  const movingSector = movingSectorId === null ? null : (sectors.find(item => item.id === movingSectorId) ?? null)
  const moveTargetIds = new Set(movingSector ? getMoveCandidates(movingSector).map(item => item.id) : [])
  const cancelMove = () => setMovingSectorId(null)
  const confirmMove = async (target: SectorItem | null) => {
    if (!movingSector) return
    const destination = target ? getSectorPath(target) : '최상위'
    if (!await appConfirm(`${movingSector.name}\n${destination} 안으로 이동하시겠습니까?`)) return
    reparentSector.mutate({ id: movingSector.id, parentId: target ? target.id : null }, { onSuccess: () => setMovingSectorId(null) })
  }
  useEffect(() => {
    if (movingSectorId === null) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMovingSectorId(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [movingSectorId])

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
  // 대·중·소분류별 개수 — 각 열 머리글에 따로 적는다(검색 중에는 맞는 업종과 그 상위 업종만 센다).
  const sectorCounts = [
    viewSectors.filter(sector => sector.depth === 0).length,
    viewSectors.filter(sector => sector.depth === 1).length,
    // 3단계 이하의 세부 업종도 소분류에 포함해 전체 개수가 항상 합산되게 한다.
    viewSectors.filter(sector => sector.depth >= 2).length,
  ]
  // 가장 깊이 선택된 열 — 이 열의 머리글만 강조색으로 칠하고 화살표를 붙인다.
  const activeColumn = selectedMiddleId !== null ? 2 : selectedMajorId !== null ? 1 : 0
  useReportCountLabel(`${toCount(viewSectors.length)}/${toCount(sectors.length)}업종`, onCountLabelChange)
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
            {/* 입력칸 왼쪽을 항목 이름 글자의 시작선에 맞춘다 — 손잡이(24px) + 간격(4px) + 번호 칸(28px) + 간격(8px) = 64px. */}
            <div className="group/create flex items-center gap-2 pl-16">
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
                placeholder={`${row.depth === 1 ? '중분류' : '소분류'} 추가`}
                title={`${quotedChain} 업종 내 세부항목 추가`}
                aria-label={`${quotedChain} 업종 내 세부항목 이름`}
                className="h-7 w-40 rounded-md border-0 bg-[#3b3b3b] px-2 text-sm font-medium text-white outline-none placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-[var(--brand)]"
              />
            </div>
          </td>
        </tr>
      )
    }

    const sector = row.item
    const isRoot = sector.parentId === null
    const expandable = isRoot || hasChildren(sector.id)
    const itemNumber = isRoot
      ? `${rootIndexById.get(sector.id) ?? row.siblingIndex}.`
      : sector.depth >= 2
        ? `(${row.siblingIndex})`
        : `${row.siblingIndex})`
    const isRenaming = renamingId === sector.id
    // 줄 어디를 눌러도(이름 글자뿐 아니라 빈 곳, 번호 칸 포함) 선택한다. 순서 이동 손잡이와 이름 바꾸기 입력창은 제외한다.
    const selectSector = () => {
      setSelectedSectorId(sector.id)
      if (sector.depth === 0) { setSelectedMajorId(current => current === sector.id ? null : sector.id); setSelectedMiddleId(null) }
      if (sector.depth === 1) setSelectedMiddleId(current => current === sector.id ? null : sector.id)
    }
    // 선택한 경로(대·중·소분류에서 고른 업종)의 줄은 종목 표의 선택된 줄과 같은 청록 배경으로 칠한다.
    const isOnSelectedPath = selectedSectorId === sector.id || selectedMajorId === sector.id || selectedMiddleId === sector.id
    return (
      <DroppableSectorRow
        key={sector.id}
        sectorId={sector.id}
        className={`group ${isRenaming ? '' : 'cursor-pointer'} ${draggedSector?.id === sector.id ? 'opacity-40' : ''} ${highlightedId === sector.id ? 'animate-row-blink' : ''}`}
        onClick={event => {
          if (isRenaming || (event.target as HTMLElement).closest('[data-no-row-select]')) return
          selectSector()
        }}
      >
        <td className={`relative py-0.5 text-left ${isOnSelectedPath ? 'bg-[var(--brand)]/35 group-hover:bg-[var(--brand)]/50' : 'group-hover:bg-[var(--brand)]/10'}`} style={{ paddingLeft: `${sector.depth * 20 + 8}px` }}>
          {dropIndicator?.sectorId === sector.id && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 z-10 h-[3px] bg-[var(--brand)] ${dropIndicator.position === 'before' ? 'top-0' : 'bottom-0'}`}
            />
          )}
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center">
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
                  <span aria-hidden="true" className="mr-2 inline-flex h-5 w-8 shrink-0 items-center justify-end pr-1 border border-gray-400 bg-white text-sm leading-none font-bold text-gray-500 tabular-nums">
                    {itemNumber}
                  </span>
                  <button
                    type="button"
                    aria-expanded={expandable ? (sector.depth === 0 ? selectedMajorId === sector.id : selectedMiddleId === sector.id) : undefined}
                    className="truncate border-0 bg-transparent p-0 text-left text-sm text-white"
                  >
                    {sector.name}
                  </button>
                  {(childCountByParent.get(sector.id) ?? 0) > 0 && (
                    <span className="ml-1 shrink-0 text-sm text-gray-400">({toCount(childCountByParent.get(sector.id) ?? 0)})</span>
                  )}
                  {movingSector && moveTargetIds.has(sector.id) && (
                    <button
                      type="button"
                      data-no-row-select
                      title={`${movingSector.name}을(를) ${sector.name} 안으로 이동`}
                      onClick={() => void confirmMove(sector)}
                      className="ml-auto mr-2 h-6 shrink-0 rounded border border-[var(--brand)] bg-transparent px-2 text-xs font-bold text-[var(--brand)] hover:bg-[var(--brand)] hover:text-black"
                    >
                      여기로
                    </button>
                  )}
                  {/* 선택한 항목은 줄 오른쪽 끝에 세부 업종 추가·이름 변경·삭제 아이콘을 보여 준다. 이동 모드 중에는 "여기로" 버튼과 겹치지 않게 숨긴다. */}
                  {selectedSectorId === sector.id && !movingSector && (
                    <span className="ml-auto flex shrink-0 items-center gap-0.5 pl-2 pr-2">
                      {sector.depth <= ADD_CHILD_MAX_PARENT_DEPTH && (
                        <button type="button" data-no-row-select title="세부 업종 추가" aria-label={`${sector.name} 세부 업종 추가`} onClick={() => toggleAddChild(sector.id)} className="flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-gray-300 outline-none hover:text-[var(--brand)]">
                          <PlusIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" data-no-row-select title="이름 변경" aria-label={`${sector.name} 이름 변경`} onClick={() => startRename(sector)} className="flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-gray-300 outline-none hover:text-[var(--brand)]">
                        <EditIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        data-no-row-select
                        title="삭제"
                        aria-label={`${sector.name} 삭제`}
                        onClick={() => {
                          if (isProtectedSector(sector)) {
                            void appAlert(`${sector.name}\n${NEW_LISTING_DELETE_MESSAGE}`)
                            return
                          }
                          remove(sector.id, sector.name)
                        }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-gray-300 outline-none hover:text-red-500"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </span>
                  )}
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
        const grabbed = event.activatorEvent.target as HTMLElement | null
        const handleRect = grabbed?.closest('button')?.getBoundingClientRect()
        const rowRect = grabbed?.closest('tr')?.getBoundingClientRect()
        setDraggedRow(handleRect && rowRect ? { width: rowRect.width, offsetX: rowRect.left - handleRect.left } : null)
      }}
      onDragEnd={event => {
        setDropIndicator(null)
        setDraggedSector(null)
        setDraggedRow(null)
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
        setDraggedRow(null)
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <SearchBar
          query={query}
          onChange={setQuery}
          placeholder="업종 검색"
          ariaLabel="업종 검색"
        />
        <div className="relative grid min-h-0 flex-1 grid-cols-3 overflow-hidden select-none [&_input]:select-text">
          {(['대분류', '중분류', '소분류'] as const).map((label, index) => (
            <div key={label} className="flex min-h-0 min-w-0 flex-col">
              <div className={`flex h-7 shrink-0 items-center justify-center gap-2 bg-[#2b3a4f] text-sm font-bold ${index < 2 ? 'border-r border-white/15' : ''} ${index === activeColumn ? 'text-[var(--brand)]' : 'text-slate-100'}`}>
                {label} ({toCount(sectorCounts[index])})
                {index === activeColumn && <span aria-hidden="true" className="text-[var(--brand)]">⌃</span>}
              </div>
              <div className={`min-h-0 flex-1 overflow-auto scrollbar-hide ${index < 2 ? 'border-r border-slate-700' : ''}`}>
                <table className="nes-table is-dark custom-page-table custom-sector-table w-full text-sm [border-collapse:separate] [border-spacing:0] [&_td]:border-slate-700 [&_td]:border-r-0"><tbody>{columnRows[index].map(renderRow)}</tbody></table>
              </div>
            </div>
          ))}
          {/* 업종이 하나도 없으면 거래소·MARKETRY 표와 같은 안내 글을 가운데에 보여준다. */}
          {viewSectors.length === 0 && <EmptyMessage message={sectors.length === 0 ? EMPTY_DATA_MESSAGE : EMPTY_SEARCH_MESSAGE} topClass="top-7" />}
        </div>
      </div>
      {/* 커서를 따라다니는 드래그 미리보기 — 끌고 있는 줄을 원래 폭의 한 줄 그대로(손잡이·번호·이름) 청록 배경에 그림자를 줘서 들어 올린 것처럼 보여 준다. */}
      <DragOverlay>
        {draggedSector && (() => {
          const siblings = orderSectors(sectors.filter(item => item.parentId === draggedSector.parentId), draggedSector.parentId, sectorOrder)
          const position = siblings.findIndex(item => item.id === draggedSector.id) + 1
          const number = draggedSector.parentId === null ? `${position}.` : draggedSector.depth >= 2 ? `(${position})` : `${position})`
          const childCount = childCountByParent.get(draggedSector.id) ?? 0
          return (
            <div
              style={{ width: draggedRow?.width, marginLeft: draggedRow?.offsetX, paddingLeft: `${draggedSector.depth * 20 + 8}px` }}
              className="flex items-center border-y-2 border-[var(--brand)] bg-[#1d4a57] py-0.5 text-sm text-white shadow-xl"
            >
              <span aria-hidden="true" className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center text-xl leading-none text-gray-300">⠿</span>
              <span aria-hidden="true" className="mr-2 inline-flex h-5 w-8 shrink-0 items-center justify-end pr-1 border border-gray-400 bg-white text-sm leading-none font-bold text-gray-500 tabular-nums">{number}</span>
              <span className="truncate">{draggedSector.name}</span>
              {childCount > 0 && <span className="ml-1 shrink-0 text-gray-300">({toCount(childCount)})</span>}
            </div>
          )
        })()}
      </DragOverlay>
    </DndContext>
    {settingsActionsTarget && createPortal(
      <section aria-label="업종 관리" className="mb-6">
        <h2 className="mb-3 text-[15px] font-medium leading-[22px] text-white">업종 관리</h2>
        {selectedSector && <div className="mb-3 rounded-md border border-white/15 bg-black/20 p-2 text-sm text-white">
          <div className="mb-2 text-base font-medium">
            {/* 대분류 › 중분류 › 소분류를 한 줄에 잇지 않고 단계마다 줄을 바꿔 보여 준다 — 깊은 단계일수록 안쪽으로 들여쓰고 앞에 꺽쇠를 둔다. */}
            {getSectorPath(selectedSector).split(' › ').map((name, index) => (
              <div key={index} className="flex items-center truncate leading-7" style={{ paddingLeft: `${index * 16}px` }}>
                {index > 0 && (
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-1 h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                )}
                <span className="min-w-0 truncate">{name}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" title="다른 업종 안으로 이동" onClick={() => setMovingSectorId(selectedSector.id)} className={ICON_BUTTON_CLASS}><span aria-hidden="true" className="text-base leading-none">↪</span></button>
            {movingSector && (
              <button type="button" onClick={cancelMove} className="h-7 rounded border border-gray-600 bg-zinc-800 px-2 text-xs text-gray-200 hover:text-white">이동 취소</button>
            )}
          </div>
          {movingSector && (
            <div className="mt-2 rounded border border-[var(--brand)]/50 bg-[var(--brand)]/10 p-2 text-xs leading-relaxed text-gray-100">
              <p>
                <b>{movingSector.name}</b>을(를) 옮길 상위 업종 줄 오른쪽의 <b className="text-[var(--brand)]">여기로</b> 버튼을 누르세요. 줄을 눌러 펼치면 다른 업종도 찾을 수 있습니다.
              </p>
              {movingSector.parentId !== null && (
                <button type="button" onClick={() => void confirmMove(null)} className="mt-1.5 h-6 rounded border border-gray-500 bg-zinc-800 px-2 text-xs text-white hover:border-[var(--brand)] hover:text-[var(--brand)]">
                  최상위로 이동
                </button>
              )}
            </div>
          )}
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
