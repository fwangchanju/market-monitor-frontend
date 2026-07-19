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
    <div className="tab-bar" role="radiogroup">
      {options.map(option => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          className={`tab-btn ${option === value ? 'active' : ''}`}
          onClick={() => onChange(option)}
        >
          {labelFor(option)}
        </button>
      ))}
    </div>
  )
}
