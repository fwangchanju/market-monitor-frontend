interface Props {
  className?: string
}

export default function Spinner({ className = 'h-8 w-8' }: Props) {
  return <div className={`animate-spin rounded-full border-2 border-gray-600 border-t-[#4f8fd6] ${className}`} />
}
