import { DndContext } from '@dnd-kit/core'
import { useWatchStockDragEnd } from '@/hooks/useWatchStockDragEnd'
import Sidebar from './Sidebar'
import MainStockSection from './MainStockSection'
import WatchStockSection from './WatchStockSection'
import StockSearchSection from './StockSearchSection'

interface Props {
  open: boolean
  onClose: () => void
}

export default function WatchStockSidebar({ open, onClose }: Props) {
  const handleDragEnd = useWatchStockDragEnd()

  return (
    <Sidebar open={open} onClose={onClose}>
      <DndContext onDragEnd={handleDragEnd}>
        <MainStockSection />
        <WatchStockSection />
        <StockSearchSection />
      </DndContext>
    </Sidebar>
  )
}
