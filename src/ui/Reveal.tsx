import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

/** Entrance fade/slide for dashboard sections; honours prefers-reduced-motion. */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce === true) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
