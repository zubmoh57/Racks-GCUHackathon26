import { useRef } from 'react'
import type { ShareKey } from './finance'

export function AllocationPie({ percentages, colors, totalLabel, canInvest, onDividerChange }: {
  percentages: number[]; colors: string[]; totalLabel: string; canInvest: boolean
  onDividerChange: (first: ShareKey, second: ShareKey, percentage: number) => void
}) {
  const dragging = useRef<{ first: ShareKey; second: ShareKey; boundary: number; start: number; end: number } | null>(null)
  const remaining = Math.max(0, 100 - percentages[0])
  const handles = [
    { first: 'freedom' as const, second: 'cushion' as const, label: 'Spending and cash savings divider', value: percentages[1], start: percentages[0], end: 100 - percentages[3], boundary: percentages[0] + percentages[1] },
    ...(canInvest ? [{ first: 'cushion' as const, second: 'future' as const, label: 'Cash savings and investing divider', value: percentages[2], start: percentages[0] + percentages[1], end: 100, boundary: 100 - percentages[3] }] : []),
  ].filter(handle => handle.end > handle.start)
  let start = 0
  return <div className="allocation-pie">
    <svg viewBox="0 0 240 240" role="group" aria-label="Adjust your monthly allocation pie chart"
      onPointerMove={event => {
        if (!dragging.current) return
        const box = event.currentTarget.getBoundingClientRect()
        const x = event.clientX - box.left - box.width / 2, y = event.clientY - box.top - box.height / 2
        const raw = ((Math.atan2(x, -y) / (2 * Math.PI) * 100) + 100) % 100
        const last = dragging.current.boundary
        const nearest = [raw - 100, raw, raw + 100].sort((a, b) => Math.abs(a - last) - Math.abs(b - last))[0]
        const boundary = Math.max(dragging.current.start, Math.min(dragging.current.end, nearest))
        dragging.current.boundary = boundary
        onDividerChange(dragging.current.first, dragging.current.second, boundary - dragging.current.start)
      }} onPointerUp={() => { dragging.current = null }} onPointerCancel={() => { dragging.current = null }}>
      <circle cx="120" cy="120" r="88" fill="none" stroke="#e5e7eb" strokeWidth="32" aria-hidden="true" />
      {percentages.map((percentage, index) => {
        const offset = start; start += percentage
        return percentage > 0 ? <circle key={index} cx="120" cy="120" r="88" pathLength="100" fill="none" stroke={colors[index]} strokeWidth="32" strokeDasharray={`${percentage} ${100 - percentage}`} strokeDashoffset={-offset} transform="rotate(-90 120 120)" aria-hidden="true" /> : null
      })}
      {remaining > 0 && percentages.some(value => value > 0) && handles.map(handle => {
        const radians = handle.boundary / 100 * 2 * Math.PI
        const x = 120 + 88 * Math.sin(radians), y = 120 - 88 * Math.cos(radians)
        return <g className="pie-handle" key={handle.first} role="slider" tabIndex={0} aria-label={handle.label} aria-valuemin={0} aria-valuemax={Math.round((handle.end - handle.start) * 10) / 10} aria-valuenow={handle.value} aria-valuetext={`${handle.value}% of monthly income`}
          onPointerDown={event => { event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); dragging.current = { first: handle.first, second: handle.second, boundary: handle.boundary, start: handle.start, end: handle.end } }}
          onLostPointerCapture={() => { dragging.current = null }}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const change = event.key === 'Home' ? 0 : event.key === 'End' ? handle.end - handle.start : handle.value + (['ArrowUp', 'ArrowRight'].includes(event.key) ? 1 : -1)
            onDividerChange(handle.first, handle.second, change)
          }}>
          <title>{handle.label}: drag to move money between these categories</title>
          <circle cx={x} cy={y} r="17" fill="transparent" />
          <circle cx={x} cy={y} r="7" fill="white" stroke="#232f3e" strokeWidth="2.5" />
        </g>
      })}
    </svg>
    <div className="pie-centre"><span>MONTHLY MONEY IN</span><strong>{totalLabel}</strong><small>Drag a divider</small></div>
  </div>
}
