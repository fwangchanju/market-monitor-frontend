interface Props<T extends string> {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  labelFor?: (option: T) => string
  bordered?: boolean
  className?: string
}

export default function TabSelector<T extends string>({
  options, value, onChange, labelFor = (o: T) => o, bordered = true, className = '',
}: Props<T>) {
  return (
    <div
      className={`flex flex-wrap gap-1 ${bordered ? 'rounded-md border-2 border-gray-600 p-1' : ''} ${className}`}
      role="radiogroup"
    >
      {options.map(option => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          className={`nes-btn whitespace-nowrap text-base ${option === value ? 'is-primary' : ''}`}
          onClick={() => onChange(option)}
        >
          {labelFor(option)}
        </button>
      ))}
    </div>
  )
}
