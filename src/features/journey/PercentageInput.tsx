import { useEffect, useId, useRef, useState } from 'react'

const format = (value: number) => String(Math.round(value * 10) / 10)
const parse = (text: string) => /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text.trim()) ? Number(text.trim().replace(',', '.')) : NaN

export function PercentageInput({ label, value, maximum, disabled, onChange, onDraftChange, onValidityChange }: {
  label: string; value: number; maximum: number; disabled: boolean
  onChange: (value: number) => void; onDraftChange: () => void; onValidityChange: (valid: boolean) => void
}) {
  const [draft, setDraft] = useState(format(value))
  const [error, setError] = useState('')
  const focused = useRef(false)
  const edited = useRef(false)
  const id = useId()
  useEffect(() => {
    if (!focused.current || disabled) setDraft(format(value))
    if (disabled) { focused.current = false; setError(''); onValidityChange(true) }
  }, [value, disabled])

  return <label className="percentage-input"><span className="sr-only">{label} percentage</span>
    <input type="text" inputMode="decimal" value={draft} disabled={disabled} aria-invalid={!!error} aria-describedby={error ? id : undefined}
      onFocus={event => { focused.current = true; edited.current = false; event.currentTarget.select() }}
      onChange={event => {
        const text = event.target.value
        setDraft(text); edited.current = true; onDraftChange()
        const number = parse(text)
        const valid = Number.isFinite(number)
        onValidityChange(valid)
        setError(text.trim() && !valid ? 'Enter a percentage, such as 45.' : '')
        if (valid) onChange(number)
      }}
      onBlur={() => {
        focused.current = false
        if (!draft.trim() || !edited.current) { setDraft(format(value)); setError(''); onValidityChange(true); return }
        const number = parse(draft)
        if (!Number.isFinite(number)) { setError('Enter a percentage, such as 45.'); onValidityChange(false); return }
        const clamped = Math.max(0, Math.min(maximum, Math.round(number * 10) / 10))
        setDraft(format(clamped)); onChange(clamped); onValidityChange(true)
      }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
    <span aria-hidden="true">%</span>{error && <small id={id} role="alert" className="percentage-error">{error}</small>}
  </label>
}
