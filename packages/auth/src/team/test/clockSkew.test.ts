import * as teams from '../index.js'
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
  describe('clock skew', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    /**
     * `validateTimestampNotInFuture` refuses a link whose timestamp is ahead of this device's
     * clock, with no tolerance at all. That's a fair thing to report, but it can't be a reason to
     * refuse to open a team: our clock runs behind the one that wrote a link whenever an NTP step
     * corrects us backwards, whenever we resume from sleep, or simply whenever a peer is running a
     * few minutes fast — and `Store.dispatch` appends without validating, so a peer's fast clock
     * gets onto the graph unchallenged.
     *
     * The graph can't change to fix that, so refusing it would make the team unopenable until wall
     * clock passed the highest timestamp in it. Hence only the structural rules are fatal in
     * `makeMachine`; this rule is advisory, and `Store.validate` is where it gets asked about.
     */
    it('loads a team whose links were written by a clock running ahead of ours', () => {
      const saved = withClockAhead(TEN_MINUTES, () => {
        const { alice } = setup('alice')
        alice.team.addRole('managers')
        return {
          graph: alice.team.save(),
          context: alice.localContext,
          keys: alice.team.teamKeys(),
        }
      })

      // Back on our own clock, every timestamp in that graph is in the future
      const reloaded = teams.load(saved.graph, saved.context, saved.keys)
      expect(reloaded.teamName).toBe('Spies Я Us')
      expect(reloaded.hasRole('managers')).toBe(true)
    })

    it('merges a peer whose clock was running ahead of ours', () => {
      const { alice, bob } = setup('alice', 'bob')

      withClockAhead(TEN_MINUTES, () => {
        bob.team.addRole('managers')
      })

      expect(() => alice.team.merge(bob.team.graph)).not.toThrow()
      expect(alice.team.hasRole('managers')).toBe(true)

      // ...and her own graph is still something she can put away and open again
      const reloaded = teams.load(alice.team.save(), alice.localContext, alice.team.teamKeys())
      expect(reloaded.hasRole('managers')).toBe(true)
    })

    /**
     * The sequence that made the order rule impossible to have as a fatal one: merge a peer whose
     * clock is fast, then do anything at all on our own correct clock. `append` stamps `Date.now()`
     * with no clamp against `graph.head`, so our link comes out older than the link it descends
     * from — through no one's fault, with no adversary, and with nothing either peer could have
     * done differently.
     *
     * `dispatch` doesn't validate, so we'd see no error at the time; we'd find out on the next
     * load, and the peer we merged from could never merge our graph again. Wall clock never
     * repairs it, because the graph doesn't change. This is the case the earlier skew tests
     * missed — they merged, but never appended afterwards.
     */
    it('survives appending on a correct clock after merging a peer whose clock ran fast', () => {
      const { alice, bob } = setup('alice', 'bob')

      withClockAhead(TEN_MINUTES, () => {
        bob.team.addRole('managers')
      })
      alice.team.merge(bob.team.graph)
      expect(alice.team.hasRole('managers')).toBe(true)

      // 👩🏾 Alice, on a correct clock, does something ordinary. Her link is now ten minutes older
      // than the one it descends from.
      alice.team.addRole('editors')

      // She can still put her team away and open it again...
      const reloaded = teams.load(alice.team.save(), alice.localContext, alice.team.teamKeys())
      expect(reloaded.hasRole('editors')).toBe(true)

      // ...and 👨🏻‍🦲 Bob can still merge what she did
      bob.team.merge(alice.team.graph)
      expect(bob.team.hasRole('editors')).toBe(true)
    })

    /** The skew is still reported — it just isn't fatal. */
    it('still reports the skew when asked', () => {
      const { alice, bob } = setup('alice', 'bob')

      withClockAhead(TEN_MINUTES, () => {
        bob.team.addRole('managers')
      })
      alice.team.merge(bob.team.graph)

      const { store } = alice.team as unknown as {
        store: { validate: () => { isValid: boolean; error?: { message: string } } }
      }
      const result = store.validate()
      expect(result.isValid).toBe(false)
      // ...and specifically for the skew, not for some other rule having failed
      expect(result.error?.message ?? '').toMatch(/timestamp/i)
    })
  })
})
