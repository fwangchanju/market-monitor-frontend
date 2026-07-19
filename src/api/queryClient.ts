import { QueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // staleTime/refetchInterval은 여기서 전역으로 정하지 않음 - 시장 데이터(수시 갱신)와
      // 참조 데이터(일 단위 갱신) 비중이 대등해서 어느 한쪽을 기본값으로 삼기 애매하고,
      // 지금은 훅 개수도 적어 각 훅이 hooks/cacheConfig의 프리셋을 명시적으로 선택해 씀.
      // 훅이 늘어나 반복이 부담되면 그때 전역 기본값 도입을 다시 고려.
      refetchOnWindowFocus: false,
    },
  },
})

export default queryClient
