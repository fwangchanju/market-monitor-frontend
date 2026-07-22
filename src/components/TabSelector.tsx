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
    <div className="flex gap-1" role="radiogroup">
      {options.map(option => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          className={`nes-btn m-0 text-xs ${option === value ? 'is-primary' : ''}`}
          onClick={() => onChange(option)}
        >
          {labelFor(option)}
        </button>
      ))}
    </div>
  )
}
