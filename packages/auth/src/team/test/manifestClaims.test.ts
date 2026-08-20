import { createKeyring, createKeyset, redactKeys, type Store } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import * as devices from '../../device/index.js'
import { redactDevice } from '../../device/index.js'
import { generateProof } from '../../invitation/index.js'
import { generateStarterKeys } from '../../invitation/generateStarterKeys.js'
import { getDeviceUserFromGraph } from '../../connection/getDeviceUserFromGraph.js'
import * as lockbox from '../../lockbox/index.js'
import { KeyType } from '../../util/index.js'
import { setup, type UserStuff } from '../../util/testing/index.js'
import * as teams from '../index.js'
import * as select from '../selectors/index.js'
import { type TeamAction, type TeamContext, type TeamState } from '../types.js'

const { TEAM, USER, ROLE } = KeyType

/**
 * A lockbox manifest is a claim by its author about a key they have not proved they hold — see
 * "The rule this is all an instance of" in `docs/internals.md`. These are the cases where something
 * outside `lockbox.open` was taking a manifest field as a fact about a member.
 */
describe('Team', () => {
  describe('a manifest that claims something about a member', () => {
    /**
     * `admitMember` is deliberately open to non-admins — `Team.admitMember` says so itself, because
     * a member knows the team keys and can hand them to someone they've let in. The admitting
     * member posts the invitee's FIRST team lockbox, and `keyMap` keeps the first keyset it sees
     * for a scope and generation. For an existing member that tie rule protects the keyset they
     * already have; for a brand-new member there is nothing older, so being first isn't a tiebreak
     * at all — it's a grant.
     *
     * Flipping the tie rule is not the fix; last-wins was measured worse. What the invitee needs is
     * an independent way to know which keyset the team actually issued, and an admission is exactly
     * the action that issues none.
     */
    const admitWith = (substituteKeys: boolean) => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
      const realTeamKeys = alice.team.teamKeys()
      const { seed } = alice.team.inviteMember()
      bob.team.merge(alice.team.graph)

      const charlie = createKeyset({ type: USER, name: 'charlie-id' })
      const charlieDevice = devices.createDevice({
        userId: 'charlie-id',
        deviceName: 'laptop',
        seed: 'charlie-laptop',
      })
      const proof = generateProof(seed, charlie)
      const minted = createKeyset({ type: TEAM, name: TEAM })

      if (substituteKeys) {
        // 👨🏻‍🦲 Bob admits her, but puts a team keyset he minted in her lockbox instead of the team's
        const { store } = bob.team as unknown as {
          store: Store<TeamState, TeamAction, TeamContext>
        }
        store.dispatch(
          {
            type: 'ADMIT_MEMBER',
            payload: {
              id: proof.id,
              userName: 'charlie',
              memberKeys: redactKeys(charlie),
              proof,
              lockboxes: [lockbox.create(minted, redactKeys(charlie))],
            },
          } as TeamAction,
          bob.team.teamKeys()
        )
        bob.team.merge(bob.team.graph)
      } else {
        bob.team.admitMember(proof, redactKeys(charlie), 'charlie')
      }

      // She adds her device, and resolves the team keys the way her client will
      const { state } = bob.team
      const withHerDevice = {
        ...state,
        lockboxes: [...state.lockboxes, lockbox.create(charlie, redactKeys(charlieDevice.keys))],
      } as TeamState

      return {
        resolve: () => select.keys(withHerDevice, charlieDevice.keys, { type: TEAM, name: TEAM }),
        realTeamKeys,
        minted,
      }
    }

    it("doesn't let whoever admits you choose the team keys you'll use", () => {
      // Control: an honest non-admin admission hands her the team's own keys
      const honest = admitWith(false)
      expect(honest.resolve()).toEqual(honest.realTeamKeys)

      // ✅ ...and a substituted keyset is not something she'll use for the team. She has no team
      // keys at all, which is the truth: nobody ever gave her any.
      const substituted = admitWith(true)
      expect(substituted.resolve).toThrowError(/Couldn't find keys the team issued/)
    })

    /**
     * `recipient.name` says who a lockbox is for; `recipient.publicKey` decides who can open it.
     * Nothing tied the two together, and both are fields a lockbox's author writes — so a lockbox
     * naming the victim while carrying somebody else's key joined the victim's group in
     * `lockboxesInScope`, and at a higher `contents.generation` it won that group. The rotation
     * then addressed the victim's replacement to the other key.
     */
    const rotateWith = (decoy: boolean) => {
      const { alice, bob, charlie, dwight } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false },
        { user: 'dwight', admin: false },
      ])

      if (decoy) {
        // Named for 👳🏽‍♂️ Charlie, carrying 👨🏻‍🦲 Bob's public key, claiming a later generation
        const real = alice.team.state.lockboxes.find(
          l => l.contents.type === TEAM && l.recipient.name === charlie.userId
        )!
        const forged = {
          ...lockbox.create(
            { ...createKeyset({ type: TEAM, name: TEAM }), generation: 5 },
            bob.user.keys
          ),
          recipient: { ...real.recipient, publicKey: redactKeys(bob.user.keys).encryption },
        }
        const { store } = bob.team as unknown as {
          store: Store<TeamState, TeamAction, TeamContext>
        }
        store.dispatch(
          {
            type: 'ADD_DEVICE',
            payload: { device: redactDevice(bob.phone!), lockboxes: [forged] },
          } as TeamAction,
          bob.team.teamKeys()
        )
        bob.team.merge(bob.team.graph)
        alice.team.merge(bob.team.graph)
      }

      // 👩🏾 Alice rotates the team keys by removing somebody unrelated
      alice.team.remove(dwight.userId)
      charlie.team.merge(alice.team.graph)
      return { alice, charlie }
    }

    it("doesn't let a name on a manifest take a member out of a rotation", () => {
      // Control: 👳🏽‍♂️ Charlie comes through the rotation holding the team's new keys
      const control = rotateWith(false)
      expect(control.charlie.team.teamKeys()).toEqual(control.alice.team.teamKeys())

      // ✅ ...and with the decoy on the graph, he still does — he stayed a member, so a rotation
      // has to reach him
      const attacked = rotateWith(true)
      expect(attacked.alice.team.has(attacked.charlie.userId)).toBe(true)
      expect(attacked.charlie.team.teamKeys()).toEqual(attacked.alice.team.teamKeys())
      expect(attacked.charlie.team.decrypt(attacked.alice.team.encrypt('hello'))).toBe('hello')
    })

    /**
     * A joining device has no source for its own user keys but the graph, and it takes them from
     * the keyring `select.keyring` builds out of whatever lockboxes it can open. An outstanding
     * device invitation's starter keys are derived from a seed, and the public half is plaintext on
     * the graph — so anyone can address a lockbox to them. `USER -> EPHEMERAL` is an honest pairing
     * (it is how an invitation carries a member's keys to their new device), so the door has to
     * allow it.
     *
     * The keyset a joining device adopts includes the signature secret it will sign links with.
     */
    it("doesn't let a lockbox choose a joining device's own user keys", () => {
      const join = (withForgery: boolean) => {
        const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
        const teamKeys = alice.team.teamKeys()
        const { seed } = alice.team.inviteDevice()
        const forged = { ...createKeyset({ type: USER, name: alice.userId }), generation: 9 }

        if (withForgery) {
          const { store } = bob.team as unknown as {
            store: Store<TeamState, TeamAction, TeamContext>
          }
          store.dispatch(
            {
              type: 'ADD_DEVICE',
              payload: {
                device: redactDevice(bob.phone!),
                lockboxes: [lockbox.create(forged, generateStarterKeys(seed))],
              },
            } as TeamAction,
            bob.team.teamKeys()
          )
          bob.team.merge(bob.team.graph)
          alice.team.merge(bob.team.graph)
        }

        const { user } = getDeviceUserFromGraph({
          serializedGraph: alice.team.save(),
          teamKeyring: createKeyring(teamKeys),
          invitationSeed: seed,
        })
        return {
          adopted: user.keys.encryption.publicKey,
          real: alice.user.keys.encryption.publicKey,
          forged,
        }
      }

      // Control: the joining device picks up the member's own keys
      const control = join(false)
      expect(control.adopted).toBe(control.real)

      // ✅ ...and it still does with a keyset somebody else addressed to the invitation
      const attacked = join(true)
      expect(attacked.adopted).toBe(attacked.real)
      expect(attacked.adopted).not.toBe(attacked.forged.encryption.publicKey)
    })

    /**
     * `lockboxesInScope` anchors members, servers and devices to the team's record of them. ROLE and
     * EPHEMERAL recipients were left at face value on the grounds that the team keeps no record of
     * either — which was wrong. The graph carries both, just not in `state.members`.
     */
    const postDirectly = (who: ReturnType<typeof setup>['alice'], lockboxes: unknown[]) => {
      const { store } = who.team as unknown as { store: Store<TeamState, TeamAction, TeamContext> }
      try {
        store.dispatch(
          {
            type: 'ADD_DEVICE',
            payload: { device: redactDevice(who.phone!), lockboxes },
          } as TeamAction,
          who.team.teamKeys()
        )
        who.team.merge(who.team.graph)
        return 'accepted'
      } catch {
        return 'refused'
      }
    }

    it("doesn't let an invitation's ear keep receiving rotations for good", () => {
      const removedMemberStillGetsTeamKeys = (decoy: boolean) => {
        const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
        const ear = createKeyset({ type: KeyType.EPHEMERAL, name: KeyType.EPHEMERAL })
        if (decoy) {
          postDirectly(bob, [
            lockbox.create(createKeyset({ type: TEAM, name: TEAM }), redactKeys(ear)),
          ])
          try {
            alice.team.merge(bob.team.graph)
          } catch {
            // refused, which is the point
          }
        }

        alice.team.remove(bob.userId)

        // The question is whether the ear can get at the team's keys AS THEY NOW STAND — not
        // whether it can open the attacker's own lockbox, which of course it can
        const current = alice.team.teamKeys().secretKey
        return alice.team.state.lockboxes
          .filter(
            l => l.contents.type === TEAM && l.recipient.publicKey === redactKeys(ear).encryption
          )
          .some(l => lockbox.open(l, ear)?.secretKey === current)
      }

      // Control, and then the attack: an ear of the author's own claiming the TEAM scope used to
      // join the rotation set and never be evictable, so removal stopped removing
      expect(removedMemberStillGetsTeamKeys(false)).toBe(false)
      expect(removedMemberStillGetsTeamKeys(true)).toBe(false)
    })

    it("doesn't let an ear copy a real invitation's identity", () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
      const { seed } = alice.team.inviteDevice()
      bob.team.merge(alice.team.graph)

      // The invitation's signature key is on the graph, so it can be copied onto a manifest whose
      // encryption key is the author's own
      const mine = createKeyset({ type: KeyType.EPHEMERAL, name: KeyType.EPHEMERAL })
      postDirectly(bob, [
        {
          ...lockbox.create(createKeyset({ type: USER, name: alice.userId }), redactKeys(mine)),
          recipient: {
            ...redactKeys(mine),
            signature: redactKeys(generateStarterKeys(seed)).signature,
            publicKey: redactKeys(mine).encryption,
          },
        },
      ])
      try {
        alice.team.merge(bob.team.graph)
      } catch {
        // either way, it must not end up in the rotation set
      }

      // ✅ The invitation's own ear is the one that counts — the earliest lockbox naming its key,
      // which nobody can get in front of without the seed
      const inSet = select
        .lockboxesInScope(alice.team.state, { type: USER, name: alice.userId })
        .some(l => l.recipient.publicKey === redactKeys(mine).encryption)
      expect(inSet).toBe(false)
    })

    it('still rotates a role when a manifest claims to be the admin role', () => {
      const rotates = (decoy: boolean) => {
        const { alice, bob, charlie } = setup([
          'alice',
          { user: 'bob', admin: false },
          { user: 'charlie', admin: false },
        ])
        alice.team.addRole('managers')
        alice.team.addMemberRole(charlie.userId, 'managers')
        bob.team.merge(alice.team.graph)

        if (decoy) {
          postDirectly(bob, [
            {
              ...lockbox.create(
                { ...createKeyset({ type: ROLE, name: 'managers' }), generation: 5 },
                bob.user.keys
              ),
              recipient: {
                ...redactKeys(bob.user.keys),
                type: ROLE,
                name: 'admin',
                publicKey: redactKeys(bob.user.keys).encryption,
              },
            },
          ])
          try {
            alice.team.merge(bob.team.graph)
          } catch {
            // refused is fine too
          }
        }

        const before = alice.team.roleKeys('managers').secretKey
        alice.team.removeMemberRole(charlie.userId, 'managers')
        return before !== alice.team.roleKeys('managers').secretKey
      }

      // Control, then the attack: a manifest naming ROLE:admin with its author's key won that group,
      // and `removeMemberRole` became a no-op — the keyset didn't change at all
      expect(rotates(false)).toBe(true)
      expect(rotates(true)).toBe(true)
    })

    it('still gets a rotation to an invitation that is outstanding', () => {
      const { alice } = setup('alice')
      const teamKeys = alice.team.teamKeys()
      const { seed } = alice.team.inviteDevice()

      // 👩🏾 Alice re-keys herself while the invitation is still out
      alice.team.changeKeys(createKeyset({ type: USER, name: alice.userId }))

      // ✅ The ear received the new generation as well as the old, and the device that joins on
      // that invitation comes up holding her current keys
      const forTheEar = alice.team.state.lockboxes.filter(
        l => l.recipient.type === KeyType.EPHEMERAL && l.contents.type === USER
      )
      expect(forTheEar.map(l => l.contents.generation).sort((a, b) => a - b)).toEqual([0, 1])
      expect(forTheEar.every(l => lockbox.open(l, generateStarterKeys(seed)) !== undefined)).toBe(
        true
      )

      const { user } = getDeviceUserFromGraph({
        serializedGraph: alice.team.save(),
        teamKeyring: createKeyring(teamKeys),
        invitationSeed: seed,
      })
      expect(user.keys.encryption.publicKey).toBe(alice.user.keys.encryption.publicKey)
    })

    /**
     * An author picks the `prev` of the link they write, so "the earliest lockbox naming this
     * invitation's key" is not something the team decides — it is something the author can place
     * themselves in front of. Bob merges Alice's graph, reads the invitation's signature key off the
     * public INVITE link, and then writes his own ear on a head from before the invitation existed.
     *
     * Both of these were live when the ear was anchored to replay position: his ear joined the
     * rotation set AND the real invitee's ear was evicted from it, from one link.
     */
    const backdatedEar = (contentsScope: 'TEAM' | 'USER') => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
      const teamKeys = alice.team.teamKeys()

      // 👨🏻‍🦲 Bob keeps a copy of the graph from before the invitation exists
      const bobBefore = teams.load(
        bob.team.save(),
        { user: bob.user, device: bob.device },
        createKeyring(teamKeys)
      )

      const { seed } = alice.team.inviteDevice()
      bob.team.merge(alice.team.graph)
      const starter = generateStarterKeys(seed)

      // ...and writes an ear of his own on the old head, copying the invitation's signature key
      const mine = createKeyset({ type: KeyType.EPHEMERAL, name: KeyType.EPHEMERAL })
      const contents =
        contentsScope === 'TEAM'
          ? createKeyset({ type: TEAM, name: TEAM })
          : createKeyset({ type: USER, name: alice.userId })
      const forgedEar = {
        ...lockbox.create(contents, redactKeys(mine)),
        recipient: {
          ...redactKeys(mine),
          signature: redactKeys(starter).signature,
          publicKey: redactKeys(mine).encryption,
        },
      }

      const { store } = bobBefore as unknown as {
        store: Store<TeamState, TeamAction, TeamContext>
      }
      let landed = true
      try {
        store.dispatch(
          {
            type: 'ADD_DEVICE',
            payload: { device: redactDevice(bob.phone!), lockboxes: [forgedEar] },
          } as TeamAction,
          bobBefore.teamKeys()
        )
        alice.team.merge(bobBefore.graph)
      } catch {
        landed = false
      }

      return {
        landed,
        hisEarCounts: (scope: { type: string; name: string }) =>
          select
            .lockboxesInScope(alice.team.state, scope)
            .some(l => l.recipient.publicKey === redactKeys(mine).encryption),
        realEarCounts: select
          .lockboxesInScope(alice.team.state, { type: USER, name: alice.userId })
          .some(l => l.recipient.publicKey === redactKeys(starter).encryption),
        alice,
      }
    }

    /**
     * What the door rule uniquely catches, and the reason it is not redundant with the anchor: the
     * anchor decides which ear belongs to an invitation, and an ear that belongs to nobody is
     * simply not in the rotation set — but only once the question is asked in replay order the
     * author didn't choose. Refusing TEAM keys in an ear settles it before ordering matters at all.
     */
    it("won't take an ear holding anything but the member's own keys, backdated or not", () => {
      const backdated = backdatedEar('TEAM')
      expect(backdated.landed).toBe(false)
      expect(backdated.hisEarCounts({ type: TEAM, name: TEAM })).toBe(false)
      expect(backdated.realEarCounts).toBe(true)
    })

    /**
     * The anchor's source, pinned directly — because the attack above cannot pin it reliably. Which
     * ear wins under the old rule depends on where the resolver puts the backdated link, and that
     * varies run to run: reverting the anchor to "earliest lockbox" and running the suite three
     * times gave one pass and two failures. An anchor whose correctness is a coin flip is not an
     * anchor, and a test over it would be a flaky pin.
     */
    it('records which ear an invitation was posted with, on the link that posted it', () => {
      const { alice } = setup('alice')
      const { seed, id } = alice.team.inviteDevice()

      expect(alice.team.state.invitations[id].earPublicKey).toBe(
        redactKeys(generateStarterKeys(seed)).encryption
      )
    })

    it("doesn't let a backdated ear take the invitation's place", () => {
      // A `USER`-scoped ear is a shape the door has to allow, so this one lands on the graph
      const backdated = backdatedEar('USER')
      expect(backdated.landed).toBe(true)

      // ✅ ...and it is still not the invitation's ear, because which ear that is was written by
      // the reducer on the link that posted the invitation, not decided by arrival order
      expect(backdated.hisEarCounts({ type: USER, name: backdated.alice.userId })).toBe(false)
      expect(backdated.realEarCounts).toBe(true)
    })

    /**
     * Moving the ear's identity into reducer-written state fixed the VALUE but not the SELECTION:
     * the lookup is a `find` over `state.invitations`, whose iteration order is insertion order,
     * which is replay order, which an author moves by choosing `prev`. Nothing required an
     * invitation's `publicKey` to be new — only its `id` — so a second record could carry a copy of
     * the key and race the real one. Measured over twelve attempts, six put the attacker's record
     * first, and grinding for a favourable hash is free.
     */
    it('refuses an invitation whose public key is already on the graph', () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
      const { seed } = alice.team.inviteDevice()
      bob.team.merge(alice.team.graph)
      const stolen = redactKeys(generateStarterKeys(seed)).signature

      const postACopy = () => {
        const { store } = bob.team as unknown as {
          store: Store<TeamState, TeamAction, TeamContext>
        }
        store.dispatch(
          {
            type: 'INVITE_DEVICE',
            payload: {
              invitation: {
                kind: 'DEVICE',
                id: 'a-different-id',
                publicKey: stolen,
                expiration: 0,
                maxUses: 1,
                userId: bob.userId,
              },
            },
          } as TeamAction,
          bob.team.teamKeys()
        )
      }

      expect(postACopy).toThrowError(/public key has already been posted/)
    })

    it('still lets an invitation be reissued after it is revoked', () => {
      const { alice } = setup('alice')
      const first = alice.team.inviteDevice()
      alice.team.revokeInvitation(first.id)

      // ✅ A genuine reissue uses a new seed, so a new key, and the uniqueness rule doesn't bite
      expect(() => alice.team.inviteDevice()).not.toThrow()

      // ...and reusing the old seed was already refused, by the seed check that predates this
      expect(() => alice.team.inviteDevice({ seed: first.seed })).toThrowError(/already been used/)
    })

    /**
     * An ear exists so a new device can pick up ITS OWN member's keys. Without that restriction a
     * member could issue a perfectly legitimate invitation — unique key, their own userId, nothing
     * for a uniqueness rule to catch — and hang a lockbox naming somebody else's USER scope on its
     * ear.
     */
    it("doesn't let an ear collect a scope that isn't its member's", () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
      const { seed } = bob.team.inviteDevice()
      const hisEar = generateStarterKeys(seed)

      const { store } = bob.team as unknown as { store: Store<TeamState, TeamAction, TeamContext> }
      store.dispatch(
        {
          type: 'ADD_DEVICE',
          payload: {
            device: redactDevice(bob.phone!),
            lockboxes: [
              lockbox.create(createKeyset({ type: USER, name: alice.userId }), redactKeys(hisEar)),
            ],
          },
        } as TeamAction,
        bob.team.teamKeys()
      )
      alice.team.merge(bob.team.graph)

      // 👩🏾 Alice re-keys herself
      alice.team.changeKeys(createKeyset({ type: USER, name: alice.userId }))

      // ✅ His ear did not receive her actual new keys. (Comparing against her real secret, not
      // just "can it open something" — his own decoy is of course openable by him.)
      const hers = alice.user.keys.encryption.secretKey
      const collected = alice.team.state.lockboxes
        .filter(
          l =>
            l.contents.type === USER &&
            l.contents.name === alice.userId &&
            l.recipient.publicKey === redactKeys(hisEar).encryption
        )
        .some(l => lockbox.open(l, hisEar)?.encryption.secretKey === hers)
      expect(collected).toBe(false)
    })

    /**
     * `keyMap`'s first-wins tie rule, which nothing pinned and which `docs/internals.md` wrongly
     * described as no longer load-bearing. It is what stops a minted generation-0 TEAM keyset from
     * becoming current when it ends up LAST in `keyHistory` — which backdating does reach: of four
     * attempts, one placed the forgery last.
     *
     * Built directly rather than through the resolver, because which position a backdated link
     * lands in varies run to run and a test over that would be flaky.
     */
    it('keeps the keyset it already had when a later one claims the same generation', () => {
      const { alice, charlie } = setup(['alice', { user: 'charlie', admin: false }])
      alice.team.remove(charlie.userId) // so there is a generation 1 as well

      const forged = createKeyset({ type: TEAM, name: TEAM }) // generation 0, minted
      const state = {
        ...alice.team.state,
        lockboxes: [...alice.team.state.lockboxes, lockbox.create(forged, alice.user.keys)],
        keyHistory: {
          ...alice.team.state.keyHistory,
          'TEAM:TEAM': [...alice.team.state.keyHistory['TEAM:TEAM'], redactKeys(forged).encryption],
        },
      } as TeamState

      // ✅ The forgery is the newest thing in the scope's history and still isn't current, because
      // generation 0 is a slot 👩🏾 Alice already had
      expect(
        select.keys(state, alice.device.keys, { type: TEAM, name: TEAM }).encryption.publicKey
      ).not.toBe(redactKeys(forged).encryption)
    })
  })

  /**
   * A lockbox is a grant, and a grant has two halves that must agree: the scope it hands over and
   * the holder it hands it to. Every round before this one made the HOLDER more trustworthy, which
   * is orthogonal to whether that holder should be in that SCOPE — so none of them touched this.
   *
   * None of these needs a forgery. The attacker uses their own genuine registered keys as the
   * recipient; the only lie is which scope the contents name. Each is measured against the victim's
   * ACTUAL current secret, not against "can they open something naming the victim's scope" — a
   * decoy satisfies that, and it has produced three false readings in this work.
   */
  describe('a lockbox handing a scope to a holder with no claim on it', () => {
    const postDecoy = (who: UserStuff, boxes: unknown[]) => {
      const { store } = who.team as unknown as { store: Store<TeamState, TeamAction, TeamContext> }
      store.dispatch(
        {
          type: 'ADD_DEVICE',
          payload: { device: redactDevice(who.phone!), lockboxes: boxes },
        } as TeamAction,
        who.team.teamKeys()
      )
      who.team.merge(who.team.graph)
    }

    /** Whether `holder` ends up holding the scope's real secret as it now stands */
    const holdsRealSecret = (
      state: TeamState,
      scope: { type: string; name: string },
      holder: Parameters<typeof lockbox.open>[1],
      realSecret: string
    ) =>
      state.lockboxes
        .filter(
          l =>
            l.contents.type === scope.type &&
            l.contents.name === scope.name &&
            l.recipient.publicKey === redactKeys(holder).encryption
        )
        .some(l => lockbox.open(l, holder)?.encryption.secretKey === realSecret)

    for (const recipientKind of ['DEVICE', 'USER'] as const) {
      it(`won't send a member's own keys to another member's ${recipientKind.toLowerCase()}`, () => {
        const run = (decoy: boolean) => {
          const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
          const his = recipientKind === 'DEVICE' ? bob.device.keys : bob.user.keys
          if (decoy) {
            // Nothing forged: his own registered keys as the recipient, her scope on the contents
            postDecoy(bob, [
              lockbox.create(createKeyset({ type: USER, name: alice.userId }), redactKeys(his)),
            ])
            alice.team.merge(bob.team.graph)
          }

          alice.team.changeKeys(createKeyset({ type: USER, name: alice.userId }))
          return holdsRealSecret(
            alice.team.state,
            { type: USER, name: alice.userId },
            his,
            alice.user.keys.encryption.secretKey
          )
        }

        expect(run(false)).toBe(false)
        expect(run(true)).toBe(false)
      })
    }

    it("won't send a role's keys to a member who isn't in that role", () => {
      const run = (decoy: boolean) => {
        const { alice, bob, charlie } = setup([
          'alice',
          { user: 'bob', admin: false },
          { user: 'charlie', admin: false },
        ])
        alice.team.addRole('managers')
        alice.team.addMemberRole(charlie.userId, 'managers')
        bob.team.merge(alice.team.graph)

        if (decoy) {
          // 👨🏻‍🦲 Bob can't open the managers' keys, but he can name the scope
          postDecoy(bob, [
            lockbox.create(
              createKeyset({ type: ROLE, name: 'managers' }),
              redactKeys(bob.user.keys)
            ),
          ])
          alice.team.merge(bob.team.graph)
        }

        alice.team.removeMemberRole(charlie.userId, 'managers') // rotates managers
        return holdsRealSecret(
          alice.team.state,
          { type: ROLE, name: 'managers' },
          bob.user.keys,
          alice.team.roleKeys('managers').encryption.secretKey
        )
      }

      expect(run(false)).toBe(false)
      expect(run(true)).toBe(false)
    })

    it("won't send one role's keys to a different role", () => {
      const run = (decoy: boolean) => {
        const { alice, bob, charlie } = setup([
          'alice',
          { user: 'bob', admin: false },
          { user: 'charlie', admin: false },
        ])
        alice.team.addRole('managers')
        alice.team.addMemberRole(charlie.userId, 'managers')
        alice.team.addRole('engineers')
        alice.team.addMemberRole(bob.userId, 'engineers')
        bob.team.merge(alice.team.graph)
        const engineers = bob.team.roleKeys('engineers')

        if (decoy) {
          // Addressed to a role 👨🏻‍🦲 Bob really is in, carrying its real current key
          postDecoy(bob, [
            lockbox.create(createKeyset({ type: ROLE, name: 'managers' }), redactKeys(engineers)),
          ])
          alice.team.merge(bob.team.graph)
        }

        alice.team.removeMemberRole(charlie.userId, 'managers')
        return holdsRealSecret(
          alice.team.state,
          { type: ROLE, name: 'managers' },
          engineers,
          alice.team.roleKeys('managers').encryption.secretKey
        )
      }

      expect(run(false)).toBe(false)
      expect(run(true)).toBe(false)
    })
  })
})
