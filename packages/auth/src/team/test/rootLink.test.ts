import { ROOT, append, createKeyset } from '@localfirst/crdx'
import * as devices from '../../device/index.js'
import * as lockbox from '../../lockbox/index.js'
import { ADMIN } from '../../role/index.js'
import * as teams from '../index.js'
import { redactUser } from '../redactUser.js'
import { serializeTeamGraph } from '../serialize.js'
import { validate } from '../validate.js'
import { type TeamGraph, type TeamLink } from '../types.js'
import { KeyType } from '../../util/index.js'
import { type ValidationResult } from '../../util/types.js'
import { setup } from '../../util/testing/index.js'
import { describe, expect, it } from 'vitest'

/**
 * The payload of the ROOT link the attacker would post: it names them as the founding member, and
 * carries a lockbox holding a keyset they minted themselves, labelled with the admin role's name.
 * That's all `roleGrantMustIncludeKeys` asks of a ROOT link, and any member can produce it.
 */
const usurpingRootPayload = (attacker: ReturnType<typeof setup>['alice']) => ({
  name: 'Pwned Я Us',
  rootMember: redactUser(attacker.user),
  rootDevice: devices.redactDevice(attacker.device),
  lockboxes: [
    lockbox.create(createKeyset({ type: KeyType.ROLE, name: ADMIN }), attacker.user.keys),
  ],
})

/** What a validator said when it refused, or an empty string if it didn't refuse. */
const refusal = (result: ValidationResult) => (result.isValid ? '' : result.error.message)

/** Appends a second ROOT link to someone's graph, bypassing `Team.dispatch`. */
const appendSecondRootLink = (attacker: ReturnType<typeof setup>['alice']) =>
  append({
    graph: attacker.team.graph,
    action: { type: ROOT, payload: usurpingRootPayload(attacker) } as any,
    user: attacker.user,
    context: { deviceId: attacker.device.deviceId },
    keys: attacker.team.teamKeys(),
  }) as TeamGraph

describe('Team', () => {
  describe('the root link', () => {
    /**
     * The attack itself. Note that both legs of `rootLinkCanOnlyBeTheFirstLink` refuse this one —
     * the link names predecessors AND it lands on a team that already exists — so disabling either
     * leg alone still leaves the escalation refused. What this pins is the first leg's message;
     * what makes the test worth having is the two assertions below it, which are the security
     * property and hold whichever leg does the refusing.
     */
    it('refuses a ROOT link dispatched onto a team that already exists', () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })
      expect(bob.team.memberIsAdmin(bob.userId)).toBe(false)

      expect(() => {
        bob.team.dispatch({ type: ROOT, payload: usurpingRootPayload(bob) } as any)
      }).toThrow(/can't come after anything/i)

      expect(bob.team.memberIsAdmin(bob.userId)).toBe(false)
      expect(bob.team.teamName).toBe('Spies Я Us')
    })

    it('refuses a second ROOT link merged from a peer', () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      expect(() => alice.team.merge(appendSecondRootLink(bob))).toThrow(
        /root link cannot have any predecessors/i
      )

      expect(alice.team.memberIsAdmin(bob.userId)).toBe(false)
      expect(alice.team.teamName).toBe('Spies Я Us')
    })

    it('refuses a second ROOT link on a cold load', () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })
      const usurpedGraph = serializeTeamGraph(appendSecondRootLink(bob))

      expect(() => teams.load(usurpedGraph, bob.localContext, bob.team.teamKeys())).toThrow(
        /root link cannot have any predecessors/i
      )
    })

    /**
     * The two legs below aren't reachable through `dispatch` or `merge` once the graph-level rule
     * holds, so they're exercised against the validator directly: they're what makes the ROOT
     * branches of `linkAuthorshipIsAuthentic`, `serversCanOnlyAdmit`, `mustBeAdmin` and
     * `removedMembersAndServersCantDoAnything` safe to skip.
     */
    it('refuses a ROOT link applied to a state that already has a team', () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })
      const rootLink = {
        hash: 'whatever',
        senderPublicKey: bob.user.keys.encryption.publicKey,
        body: {
          type: ROOT,
          payload: usurpingRootPayload(bob),
          userId: bob.userId,
          deviceId: bob.device.deviceId,
          timestamp: Date.now(),
          prev: [], // it looks like the first link on the graph...
        },
      } as unknown as TeamLink

      // ...but the state it's being applied to says otherwise
      const previousState = bob.team.state
      const result = validate(previousState, rootLink)

      expect(result.isValid).toBe(false)
      expect(refusal(result)).toMatch(/team that already exists/i)
    })

    it('refuses a link with no predecessors that is not a ROOT link', () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })

      // The state here is synthetic: a state with members but no head can't arise from a replay.
      // It's what lets this reach the rule under test — against the real initial state,
      // `linkAuthorshipIsAuthentic` refuses first, because a team with no members has no
      // registered keys for the author to have used.
      const previousState = { ...bob.team.state, head: [] }

      const firstLink = {
        hash: 'whatever',
        senderPublicKey: bob.user.keys.encryption.publicKey,
        body: {
          type: 'SET_TEAM_NAME',
          payload: { teamName: 'Pwned Я Us' },
          userId: bob.userId,
          deviceId: bob.device.deviceId,
          timestamp: Date.now(),
          prev: [],
        },
      } as unknown as TeamLink

      const result = validate(previousState, firstLink)

      expect(result.isValid).toBe(false)
      expect(refusal(result)).toMatch(/only a root link can be the first link/i)
    })

    /** Controls: the honest paths all still work. */
    it('still lets a founder create a team, and lets peers load and merge it', () => {
      const { alice, bob } = setup('alice', 'bob')

      expect(alice.team.teamName).toBe('Spies Я Us')
      expect(alice.team.memberIsAdmin(alice.userId)).toBe(true)

      alice.team.addRole('managers')
      expect(() => bob.team.merge(alice.team.graph)).not.toThrow()
      expect(bob.team.hasRole('managers')).toBe(true)

      const reloaded = teams.load(alice.team.save(), alice.localContext, alice.team.teamKeys())
      expect(reloaded.teamName).toBe('Spies Я Us')
      expect(reloaded.memberIsAdmin(alice.userId)).toBe(true)
    })
  })
})
