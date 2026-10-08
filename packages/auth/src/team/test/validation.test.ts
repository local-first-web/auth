import { setup } from '../../util/testing/index.js'
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

    /**
     * The answer has to be about the clock as it is when you ask. It used to be memoized against
     * the graph, so the first answer stood for as long as the graph didn't change — which, for the
     * rule this method exists to report, is exactly when the answer changes on its own.
     */
    it('stops reporting skew once our clock catches up', () => {
      const { alice, bob } = setup('alice', 'bob')

      withClockAhead(TEN_MINUTES, () => {
        bob.team.addRole('managers')
      })
      alice.team.merge(bob.team.graph)
      expect(alice.team.validate().isValid).toBe(false)

      // Ten minutes later, on the same unchanged graph, there's nothing left to report
      withClockAhead(TEN_MINUTES + 1000, () => {
        expect(alice.team.validate()).toEqual({ isValid: true })
      })
    })

    /** ...and the other direction, which is what an NTP step backwards does to us. */
    it('starts reporting skew when our clock steps backwards', () => {
      const { alice } = setup('alice')
      alice.team.addRole('managers')
      expect(alice.team.validate()).toEqual({ isValid: true })

      withClockAhead(-TEN_MINUTES, () => {
        expect(alice.team.validate().isValid).toBe(false)
      })
    })
  })
})
