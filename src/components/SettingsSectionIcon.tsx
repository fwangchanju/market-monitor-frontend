import type { CSSProperties } from 'react'
import compositionIcon from '@/assets/settings-icons/composition.png'
import colorsIcon from '@/assets/settings-icons/colors.png'
import favoritesIcon from '@/assets/settings-icons/favorites.png'
import industryIcon from '@/assets/settings-icons/industry.png'
import stockDisplayIcon from '@/assets/settings-icons/stock-display.png'

export type SettingsSectionIconName = 'favorites' | 'composition' | 'industry' | 'stock-display' | 'colors'

interface SettingsSectionIconProps {
  icon: SettingsSectionIconName
  selected?: boolean
  className?: string
}

const ICON_SOURCES: Record<SettingsSectionIconName, string> = {
  favorites: favoritesIcon,
  composition: compositionIcon,
  industry: industryIcon,
  'stock-display': stockDisplayIcon,
  colors: colorsIcon,
}

export default function SettingsSectionIcon({ icon, selected = false, className = '' }: SettingsSectionIconProps) {
  if (icon === 'favorites' && selected) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-[30px] w-[30px] shrink-0 ${className}`} fill="currentColor">
        <path d="M12 2.5 14.94 8.45 21.5 9.4 16.75 14.03 17.87 20.56 12 17.48 6.13 20.56 7.25 14.03 2.5 9.4 9.06 8.45Z" />
      </svg>
    )
  }

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

  return <span aria-hidden="true" className={`inline-block h-[30px] w-[30px] shrink-0 bg-current ${className}`} style={maskStyle} />
}
