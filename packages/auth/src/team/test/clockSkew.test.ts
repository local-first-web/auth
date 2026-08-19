import { generateProof } from 'invitation/index.js'
import * as teams from 'team/index.js'
import { setup } from 'util/testing/index.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type UnixTimestamp } from '@localfirst/crdx'

const MINUTE = 60 * 1000
const TEN_MINUTES = 10 * MINUTE
const AN_HOUR = 60 * MINUTE

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
     * `validateTimestamps` refuses a link whose timestamp is ahead of this device's clock, with no
     * tolerance at all. That's a fair thing to report, but it can't be a reason to refuse to open a
     * team: our clock runs behind the one that wrote a link whenever an NTP step corrects us
     * backwards, whenever we resume from sleep, or simply whenever a peer is running a few minutes
     * fast — and `Store.dispatch` appends without validating, so a peer's fast clock gets onto the
     * graph unchallenged.
     *
     * The graph can't change to fix that, so refusing it would make the team unopenable until wall
     * clock passed the highest timestamp in it. Hence only the structural rules are fatal in
     * `makeMachine`; these are advisory, and `Store.validate` is where they're asked about.
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
     * The other half of what `validateTimestamps` used to bundle together. A link can't be older
     * than a link it descends from, and that's a statement about bytes already on the graph — no
     * clock takes part, so it's structural and stays fatal.
     *
     * It has to be, because invitation expiry is judged against `link.body.timestamp`, a number
     * the link's author chose. `Team.validateInvitation` checks expiry against the author's own
     * `Date.now()`, so an author who sets their clock back gets past it, and peers replaying the
     * ADMIT link judge expiry against the backdated timestamp it carries and admit the invitee. An
     * author can't make the links they're building on any younger, though — so as long as the
     * graph carries anything later than the timestamp they chose, every peer refuses the link.
     */
    it('refuses a backdated link that is older than the link it descends from', () => {
      const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })
      const { seed } = alice.team.inviteMember({
        expiration: (Date.now() + 5 * MINUTE) as UnixTimestamp,
      })
      const proof = generateProof(seed, charlie.user.keys)

      // An hour later the invitation has expired, and the team has gone on being used
      withClockAhead(AN_HOUR, () => {
        expect(() => {
          alice.team.admitMember(proof, charlie.user.keys, charlie.user.userName)
        }).toThrow(/expired/i)
        alice.team.addRole('managers')
      })

      // 🦹‍♀️ So she puts her clock back to before the expiration and tries again. Her own
      // `validateInvitation` checks against that clock, so it lets her through, and `dispatch`
      // appends without consulting the graph — on her screen, Charlie is on the team
      withClockAhead(MINUTE, () => {
        alice.team.admitMember(proof, charlie.user.keys, charlie.user.userName)
      })
      expect(alice.team.has(charlie.user.userId)).toBe(true)

      // ...but her ADMIT link is older than the ADD_ROLE link it descends from, and that's on the
      // graph for anyone to see. Nobody else ever admits Charlie.
      expect(() => bob.team.merge(alice.team.graph)).toThrow(/earlier than a previous link/i)
      expect(bob.team.has(charlie.user.userId)).toBe(false)
      expect(() => teams.load(alice.team.save(), bob.localContext, bob.team.teamKeys())).toThrow(
        /earlier than a previous link/i
      )
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
