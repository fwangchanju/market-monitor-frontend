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
  const filterId = `settings-icon-${icon}-light-stroke`
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

  return (
    <>
      <svg aria-hidden="true" className="absolute h-0 w-0" focusable="false">
        <filter id={filterId} colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="erode" radius="0.35" result="thinner" />
          <feComposite in="SourceGraphic" in2="thinner" operator="in" />
        </filter>
      </svg>
      <span
        aria-hidden="true"
        className={`inline-block h-[30px] w-[30px] shrink-0 bg-current ${className}`}
        style={{ ...maskStyle, filter: `url(#${filterId})` }}
      />
    </>
  )
}
