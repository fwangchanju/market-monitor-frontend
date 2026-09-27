import type { CSSProperties } from 'react'
import compositionIcon from '@/assets/settings-icons/composition.png'
import colorsIcon from '@/assets/settings-icons/colors.png'
import favoritesIcon from '@/assets/settings-icons/favorites.png'
import industryIcon from '@/assets/settings-icons/industry.png'
import stockDisplayIcon from '@/assets/settings-icons/stock-display.png'

export type SettingsSectionIconName = 'favorites' | 'composition' | 'industry' | 'stock-display' | 'colors'

interface SettingsSectionIconProps {
  icon: SettingsSectionIconName
  className?: string
}

const ICON_SOURCES: Record<SettingsSectionIconName, string> = {
  favorites: favoritesIcon,
  composition: compositionIcon,
  industry: industryIcon,
  'stock-display': stockDisplayIcon,
  colors: colorsIcon,
}

export default function SettingsSectionIcon({ icon, className = '' }: SettingsSectionIconProps) {
  const iconMask = `url("${ICON_SOURCES[icon]}")`
  const maskStyle: CSSProperties = {
    maskImage: iconMask,
    maskPosition: 'center',
    maskRepeat: 'no-repeat',
    maskSize: 'contain',
    WebkitMaskImage: iconMask,
    WebkitMaskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
  }

  return <span aria-hidden="true" className={`inline-block h-6 w-6 shrink-0 bg-current ${className}`} style={maskStyle} />
}
