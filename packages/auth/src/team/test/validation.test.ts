import { setup } from 'util/testing/index.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

const TEN_MINUTES = 10 * 60 * 1000

/** Runs `fn` with this device's clock set `ms` ahead of where it really is. */
const withClockAhead = <T>(ms: number, fn: () => T): T => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(Date.now() + ms)
  try {
    return fn()
  } finally {
    vi.useRealTimers()
  }
}

describe('Team', () => {
  describe('validate', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('says a healthy team is valid', () => {
      const { alice, bob } = setup('alice', 'bob')
      alice.team.addRole('managers')
      bob.team.merge(alice.team.graph)

      expect(alice.team.validate()).toEqual({ isValid: true })
      expect(bob.team.validate()).toEqual({ isValid: true })
    })

    /**
     * The advisory rules are reported rather than enforced, which only works if an application can
     * ask. Before this method the only way in was to reach past `private readonly store`.
     */
    it("reports a peer's clock skew", () => {
      const { alice, bob } = setup('alice', 'bob')

      withClockAhead(TEN_MINUTES, () => {
        bob.team.addRole('managers')
      })
      alice.team.merge(bob.team.graph)

      const result = alice.team.validate()
      expect(result.isValid).toBe(false)
      // ...and specifically for the skew, not for some other rule having failed
      expect(result.isValid ? '' : result.error.message).toMatch(/timestamp/i)
    })
  })
})
