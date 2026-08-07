import { Link } from 'react-router-dom'

type AdminMode = 'stock' | 'category'

const MODE_LABELS: Record<AdminMode, string> = {
  stock: '종목관리',
  category: '카테고리관리',
}

const MODES: AdminMode[] = ['stock', 'category']

interface Props {
  mode: AdminMode
}

export default function AdminSidebar({ mode }: Props) {
  return (
    <aside className="w-56 shrink-0 bg-[var(--surface)] text-sm">
      <div className="p-4">
        <p className="mb-2 font-bold text-white">FILTER</p>
        <ul className="flex flex-col gap-1">
          {MODES.map(m => (
            <li key={m}>
              <Link
                to={`/admin/market-map?mode=${m}`}
                className={`block w-full rounded border-0 bg-transparent px-2 py-1 text-left font-bold ${
                  mode === m ? 'bg-gray-700 text-[#4f8fd6]' : 'text-white hover:text-gray-300'
                }`}
              >
                {MODE_LABELS[m]}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
