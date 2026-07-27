interface Props<T extends string> {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  labelFor?: (option: T) => string
}

export default function TabSelector<T extends string>({
  options, value, onChange, labelFor = (o: T) => o,
}: Props<T>) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md border-2 border-gray-600 p-1" role="radiogroup">
      {options.map(option => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          className={`nes-btn m-0 whitespace-nowrap text-base ${option === value ? 'is-primary' : ''}`}
          onClick={() => onChange(option)}
        >
          {labelFor(option)}
        </button>
      ))}
    </div>
  )
}
