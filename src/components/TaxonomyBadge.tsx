import { useSession } from '@/hooks/useSession'
import { TAXONOMY_NAMES, type TaxonomyKey } from '@/utils/taxonomyNames'

// 상단 오른쪽 분류 배지 — 지도·그룹·커스텀 페이지가 같은 모양을 쓴다.
// 내 분류는 이름 대신 내 닉네임을 보여 준다(닉네임이 없으면 '내 분류').
export default function TaxonomyBadge({ taxonomy }: { taxonomy: TaxonomyKey }) {
  const { data: session } = useSession()
  const title = taxonomy === 'MINE' ? session?.nickname || TAXONOMY_NAMES.MINE.title : TAXONOMY_NAMES[taxonomy].title
  return (
    <span className="flex min-w-0 items-center justify-end">
      <span className="min-w-0 truncate bg-[var(--brand)] px-1 py-1 text-black">*분류: {title}</span>
    </span>
  )
}
