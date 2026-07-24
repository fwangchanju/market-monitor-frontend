import { useQuery } from '@tanstack/react-query'
import { getAllowedIps } from '@/api/allowedIp'
import { allowedIpKeys } from './queryKeys'
import { INFREQUENT_DATA_CACHE } from './cacheConfig'

export function useAllowedIps() {
  return useQuery({
    queryKey: allowedIpKeys.list(),
    queryFn: getAllowedIps,
    ...INFREQUENT_DATA_CACHE,
  })
}
