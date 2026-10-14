export function ProgressBar({ percent, tone = 'accent' }: { percent: number; tone?: 'accent' | 'success' }) {
  const value = Math.max(0, Math.min(100, percent))
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${tone === 'success' ? 'bg-success' : 'bg-accent'}`}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

/** Compact circular completion indicator used on the dashboard. */
export function ProgressRing({
  percent,
  size = 96,
  stroke = 8,
  label,
}: {
  percent: number
  size?: number
  stroke?: number
  label?: string
}) {
  const value = Math.max(0, Math.min(100, percent))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--c-surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold leading-none">{Math.round(value)}%</span>
        {label && <span className="mt-1 text-[11px] text-muted">{label}</span>}
      </div>
    </div>
  )
}
