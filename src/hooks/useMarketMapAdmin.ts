import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getCategories,
  createCategory,
  renameCategory,
  getCategoryDeletePreview,
  deleteCategory,
  getVersions,
  getCurrentVersion,
  saveVersion,
  overwriteVersion,
  restoreVersion,
  deleteVersion,
  assignStockCategory,
  getStockCategories,
} from '@/api/marketMapAdmin'
import { marketMapAdminKeys } from './queryKeys'
import { STATIC_REFERENCE_CACHE, INFREQUENT_DATA_CACHE } from './cacheConfig'

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

export function useAssignStockCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stockCode, categoryId }: { stockCode: string; categoryId: number }) =>
      assignStockCategory(stockCode, categoryId),
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
