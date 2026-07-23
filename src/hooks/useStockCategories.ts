import { useQuery } from '@tanstack/react-query'
import { getStockCategories } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'
import { INFREQUENT_DATA_CACHE } from './cacheConfig'

export function useStockCategories() {
  return useQuery({
    queryKey: marketMapKeys.categories(),
    queryFn: getStockCategories,
    ...INFREQUENT_DATA_CACHE,
  })
}
