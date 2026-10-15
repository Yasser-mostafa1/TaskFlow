import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { FeedbackProvider, useToast } from './Feedback'

/**
 * Regression (Focus session integrity): App's hydration effect depends on the
 * toast API identity — if the value object changed on every provider render,
 * each toast would tear down and RE-RACE the persistence layer, resurrecting
 * stale timer state from IndexedDB. The API must be referentially stable.
 */
function Probe({ identities }: { identities: unknown[] }): ReactNode {
  const toast = useToast()
  const [count, setCount] = useState(0)
  identities.push(toast)
  return (
    <button
      type="button"
      onClick={() => {
        setCount((current) => current + 1)
        toast.push('info', 'hello')
      }}
    >
      Push {count}
    </button>
  )
}

describe('FeedbackProvider', () => {
  it('keeps the toast API referentially stable across pushes', async () => {
    const identities: unknown[] = []
    render(
      <FeedbackProvider>
        <Probe identities={identities} />
      </FeedbackProvider>,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Push/ }))

    // The consumer re-rendered after the push (its own state changed)…
    expect(identities.length).toBeGreaterThan(1)
    // …but every render saw the exact same API object.
    expect(new Set(identities).size).toBe(1)
  })
})
