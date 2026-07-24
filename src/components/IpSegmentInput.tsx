import { useRef, useState } from 'react'

interface Props {
  onSubmit: (ip: string) => void
}

export default function IpSegmentInput({ onSubmit }: Props) {
  const [segments, setSegments] = useState(['', '', '', ''])
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  const isComplete = segments.every(s => s !== '')

  const handleChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 3)
    const next = [...segments]
    next[index] = digits
    setSegments(next)
    if (digits.length === 3 && index < 3) {
      inputRefs[index + 1].current?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '.') {
      e.preventDefault()
      if (index < 3) inputRefs[index + 1].current?.focus()
    } else if (e.key === 'Backspace' && segments[index] === '' && index > 0) {
      inputRefs[index - 1].current?.focus()
    }
  }

  const handleSubmit = () => {
    if (!isComplete) return
    onSubmit(segments.join('.'))
    setSegments(['', '', '', ''])
    inputRefs[0].current?.focus()
  }

  return (
    <div className="flex items-center gap-2">
      <div className="nes-input is-dark flex w-auto items-center gap-0.5 py-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center">
            <input
              ref={inputRefs[i]}
              value={seg}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              inputMode="numeric"
              maxLength={3}
              className="w-8 border-none bg-transparent text-center outline-none"
            />
            {i < 3 && <span>.</span>}
          </div>
        ))}
      </div>
      <button type="button" className="nes-btn is-primary text-xs" disabled={!isComplete} onClick={handleSubmit}>
        추가
      </button>
    </div>
  )
}
