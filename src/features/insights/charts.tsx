import { formatDuration, parseLocal } from '../../core/dates'
import type { DayActivity } from '../../store/selectors'

const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' })

/**
 * Seven-day activity chart written as inline SVG (no chart library).
 * Two normalized bars per day: completions (accent) and focus time (info).
 * Zero days stay empty — nothing is padded or invented.
 */
export function WeekChart({ days }: { days: DayActivity[] }) {
  const W = 700
  const H = 160
  const base = H - 26
  const col = W / 7
  const barW = 20
  const maxDone = Math.max(1, ...days.map((day) => day.completed))
  const maxMinutes = Math.max(1, ...days.map((day) => day.minutes))
  const totalDone = days.reduce((sum, day) => sum + day.completed, 0)
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0)
  const scale = (value: number, max: number): number => Math.round((value / max) * (base - 8))

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${totalDone} task${totalDone === 1 ? '' : 's'} completed and ${formatDuration(totalMinutes)} focused in the last 7 days`}
        className="h-auto w-full"
      >
        <line x1={0} y1={base} x2={W} y2={base} stroke="var(--c-line)" strokeWidth={1} />
        {days.map((day, index) => {
          const cx = index * col + col / 2
          const doneHeight = scale(day.completed, maxDone)
          const minutesHeight = scale(day.minutes, maxMinutes)
          return (
            <g key={day.key}>
              <title>{`${weekdayFmt.format(parseLocal(day.key))}: ${day.completed} completed · ${formatDuration(day.minutes)} focused`}</title>
              <rect x={cx - barW - 3} y={base - doneHeight} width={barW} height={doneHeight} rx={3} fill="var(--c-accent)" />
              <rect x={cx + 3} y={base - minutesHeight} width={barW} height={minutesHeight} rx={3} fill="var(--c-info)" opacity={0.75} />
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--c-muted)">
                {weekdayFmt.format(parseLocal(day.key))}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--c-accent)' }} />
          Tasks completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--c-info)', opacity: 0.75 }} />
          Focused time
        </span>
      </div>
    </div>
  )
}
