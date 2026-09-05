import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getCategories,
  createCategory,
  renameCategory,
  reparentCategory,
  getCategoryDeletePreview,
  deleteCategory,
  getVersions,
  getCurrentVersion,
  saveVersion,
  overwriteVersion,
  restoreVersion,
  deleteVersion,
  assignStockCategory,
  updateAlias,
  bulkAssignStockCategory,
  getStockCategories,
  createMarketMapScaleThreshold,
  updateMarketMapScaleThreshold,
  deleteMarketMapScaleThreshold,
} from '@/api/marketMapAdmin'
import { marketMapAdminKeys } from './queryKeys'
import { STATIC_REFERENCE_CACHE, INFREQUENT_DATA_CACHE } from './cacheConfig'
import type { StockCategoryListItem } from '@/types/api'

interface StockCategoryListResponse {
  snapshotTime: string | null
  items: StockCategoryListItem[]
}

export function useAdminCategories() {
  return useQuery({
    queryKey: marketMapAdminKeys.categories(),
    queryFn: getCategories,
    ...INFREQUENT_DATA_CACHE,
  })
}

export function useCategoryDeletePreview() {
  return useMutation({
    mutationFn: (id: number) => getCategoryDeletePreview(id),
    meta: { skipGlobalError: true },
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
      createCategory(name, parentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketMapAdminKeys.categories() }),
  })
}

export function useRenameCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameCategory(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketMapAdminKeys.categories() }),
  })
}

export function useReparentCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, parentId }: { id: number; parentId: number | null }) => reparentCategory(id, parentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketMapAdminKeys.categories() }),
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketMapAdminKeys.categories() }),
    meta: { skipGlobalError: true },
  })
}

export function useVersions() {
  return useQuery({
    queryKey: marketMapAdminKeys.versions(),
    queryFn: getVersions,
    ...STATIC_REFERENCE_CACHE,
  })
}

export function useCurrentVersion() {
  return useQuery({
    queryKey: marketMapAdminKeys.currentVersion(),
    queryFn: getCurrentVersion,
    ...STATIC_REFERENCE_CACHE,
  })
}

export function useSaveVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (label: string) => saveVersion(label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketMapAdminKeys.versions() })
      queryClient.invalidateQueries({ queryKey: marketMapAdminKeys.currentVersion() })
    },
  })
}

export function useOverwriteVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, label }: { id: number; label: string }) => overwriteVersion(id, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketMapAdminKeys.versions() })
      queryClient.invalidateQueries({ queryKey: marketMapAdminKeys.currentVersion() })
    },
  })
}

export function useRestoreVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => restoreVersion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketMapAdminKeys.categories() })
      queryClient.invalidateQueries({ queryKey: marketMapAdminKeys.currentVersion() })
    },
  })
}

export function useDeleteVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteVersion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketMapAdminKeys.versions() }),
  })
}

// 서버 재조회 대신 캐시에 있는 그 종목의 categoryId만 직접 패치한다 — 화면에 보이는 대/중/소분류는
// categoryId를 카테고리 트리에서 찾아 렌더 시점에 계산하므로 이 필드만 바꿔도 바로 정확히 반영된다.
// 재조회(invalidate)를 하면 필터링 중이던 목록에서 방금 바꾼 종목이 새 카테고리 기준으로 곧장
// 걸러져 사라져버리는 문제가 있었다 — 목록 자체(필터링된 종목 집합)를 다시 계산하는 건 필터 조건을
// 바꾸거나 명시적으로 새로고침할 때만 일어나야 한다.
function patchStockCategoryId(
  queryClient: ReturnType<typeof useQueryClient>,
  stockCodes: string[],
  categoryId: number,
) {
  const stockCodeSet = new Set(stockCodes)
  queryClient.setQueryData<StockCategoryListResponse>(marketMapAdminKeys.stockCategories(), old =>
    old
      ? { ...old, items: old.items.map(item => (stockCodeSet.has(item.stockCode) ? { ...item, categoryId } : item)) }
      : old,
  )
}

export function useAssignStockCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stockCode, categoryId }: { stockCode: string; categoryId: number }) =>
      assignStockCategory(stockCode, categoryId),
    onSuccess: (_data, { stockCode, categoryId }) => patchStockCategoryId(queryClient, [stockCode], categoryId),
  })
}

export function useBulkAssignStockCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stockCodes, categoryId }: { stockCodes: string[]; categoryId: number }) =>
      bulkAssignStockCategory(stockCodes, categoryId),
    onSuccess: (_data, { stockCodes, categoryId }) => patchStockCategoryId(queryClient, stockCodes, categoryId),
  })
}

export function useUpdateAlias() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stockCode, alias }: { stockCode: string; alias: string | null }) => updateAlias(stockCode, alias),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marketMapAdminKeys.stockCategories() }),
  })
}

export function useStockCategories() {
  return useQuery({
    queryKey: marketMapAdminKeys.stockCategories(),
    queryFn: getStockCategories,
    ...STATIC_REFERENCE_CACHE,
  })
}

// 색상 스케일 기준값 단건 CRUD — 캐시 동기화는 여기서 하지 않는다. 이 화면(MarketMapCustomPage)의
// 실제 렌더 소스는 react-query 캐시가 아니라 로컬 colorScaleDraft라서, 페이지가 각 CRUD 호출 결과를
// 받아 draft를 직접 갱신하고 필요하면 그때 캐시도 같이 맞춘다(한 번의 "적용"이 여러 건의 create/
// update/delete로 나뉠 수 있어서, 낱개 뮤테이션마다 캐시를 건드리면 중간 상태가 잠깐씩 노출된다).
export function useCreateMarketMapScaleThreshold() {
  return useMutation({ mutationFn: createMarketMapScaleThreshold })
}

export function useUpdateMarketMapScaleThreshold() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateMarketMapScaleThreshold>[1] }) =>
      updateMarketMapScaleThreshold(id, payload),
  })
}

export function useDeleteMarketMapScaleThreshold() {
  return useMutation({ mutationFn: (id: number) => deleteMarketMapScaleThreshold(id) })
}
