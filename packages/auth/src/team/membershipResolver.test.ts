import { createTeam } from './createTeam'
import { redactUser } from './redactUser'
import { TeamAction, TeamSignatureChain } from './types'
import { ADMIN } from '@/role'
import { append, merge } from 'crdx'
import { chainSummary, clone } from '@/util'
import { setup as userSetup } from '@/util/testing'

describe('chains', () => {
  const setup = () => {
    // 👩🏾 Alice creates a chain
    let aChain: TeamSignatureChain = createTeam('Spies Я Us', alice.localContext).chain
    // 👩🏾 Alice adds 👨🏻‍🦲 Bob as admin
    aChain = append({
      chain: aChain,
      action: ADD_BOB_AS_ADMIN,
      user: alice.user,
      context: alice.chainContext,
    })

    // 👩🏾 🡒 👨🏻‍🦲 Alice shares the chain with Bob
    let bChain: TeamSignatureChain = clone(aChain)
    return { aChain, bChain }
  }

  describe('membershipResolver', () => {
    it('resolves two chains with no conflicting membership changes', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob makes a change
      bChain = append({
        chain: bChain,
        action: ADD_ROLE_MANAGERS,
        user: bob.user,
        context: bob.chainContext,
      })
      expect(sequence(bChain)).toEqual('ROOT, ADD:bob, ADD:managers')

      // 👩🏾 Concurrently, Alice makes a change
      aChain = append({
        chain: aChain,
        action: ADD_CHARLIE,
        user: alice.user,
        context: alice.chainContext,
      })
      expect(sequence(aChain)).toEqual('ROOT, ADD:bob, ADD:charlie')

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ the result will be one of these two (could be either because timestamps change with each test run)
      expectMergedResult(aChain, bChain, [
        'ROOT, ADD:bob, ADD:charlie, ADD:managers',
        'ROOT, ADD:bob, ADD:managers, ADD:charlie',
      ])
    })

    it('discards changes made by a member who is concurrently removed', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob adds Charlie to the group
      bChain = append({
        chain: bChain,
        action: ADD_CHARLIE,
        user: bob.user,
        context: bob.chainContext,
      })
      expect(sequence(bChain)).toEqual('ROOT, ADD:bob, ADD:charlie')

      // 👩🏾 but concurrently, Alice removes Bob from the group
      aChain = append({
        chain: aChain,
        action: REMOVE_BOB,
        user: alice.user,
        context: alice.chainContext,
      })
      expect(sequence(aChain)).toEqual('ROOT, ADD:bob, REMOVE:bob')

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Bob's change is discarded - Charlie is not added
      expectMergedResult(aChain, bChain, 'ROOT, ADD:bob, REMOVE:bob')
    })

    it('discards changes made by a member who is concurrently demoted', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob adds Charlie to the group
      bChain = append({
        chain: bChain,
        action: ADD_CHARLIE,
        user: bob.user,
        context: bob.chainContext,
      })
      expect(sequence(bChain)).toEqual('ROOT, ADD:bob, ADD:charlie')

      // 👩🏾 but concurrently, Alice removes Bob from the admin role
      aChain = append({
        chain: aChain,
        action: DEMOTE_BOB,
        user: alice.user,
        context: alice.chainContext,
      })
      expect(sequence(aChain)).toEqual('ROOT, ADD:bob, REMOVE:admin:bob')

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Bob's change is discarded
      expectMergedResult(aChain, bChain, 'ROOT, ADD:bob, REMOVE:admin:bob')
    })

    it(`doesn't allow a member who is removed to be concurrently added back`, () => {
      // 👩🏾 Alice creates a chain and adds Charlie
      let { aChain } = setup()
      aChain = append({
        chain: aChain,
        action: ADD_CHARLIE,
        user: alice.user,
        context: alice.chainContext,
      })

      // 👩🏾 🡒 👨🏻‍🦲 Alice shares the chain with Bob
      let bChain = clone(aChain)

      // 🔌❌ Now Alice and Bob are disconnected

      // 👩🏾 Alice removes Charlie
      aChain = append({
        chain: aChain,
        action: REMOVE_CHARLIE,
        user: alice.user,
        context: alice.chainContext,
      })
      expect(sequence(aChain)).toEqual('ROOT, ADD:bob, ADD:charlie, REMOVE:charlie')

      // 👨🏻‍🦲 Bob removes Charlie then adds him back
      bChain = append({
        chain: bChain,
        action: REMOVE_CHARLIE,
        user: bob.user,
        context: bob.chainContext,
      })
      bChain = append({
        chain: bChain,
        action: ADD_CHARLIE,
        user: bob.user,
        context: bob.chainContext,
      })
      expect(sequence(bChain)).toEqual('ROOT, ADD:bob, ADD:charlie, REMOVE:charlie, ADD:charlie')

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Charlie isn't added back
      expectMergedResult(aChain, bChain, 'ROOT, ADD:bob, ADD:charlie, REMOVE:charlie')
    })

    it('resolves mutual concurrent removals in favor of the team founder', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob removes Alice
      bChain = append({
        chain: bChain,
        action: REMOVE_ALICE,
        user: bob.user,
        context: bob.chainContext,
      })

      // 👩🏾 Alice removes Bob
      aChain = append({
        chain: aChain,
        action: REMOVE_BOB,
        user: alice.user,
        context: alice.chainContext,
      })

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Alice created the team; Bob's change is discarded, Alice stays
      expectMergedResult(aChain, bChain, ['ROOT, ADD:bob, REMOVE:bob'])
    })

    it('resolves mutual concurrent removals in favor of the senior member', () => {
      // 👩🏾 Alice creates a chain and adds Charlie
      let { aChain } = setup()
      aChain = append({
        chain: aChain,
        action: ADD_CHARLIE_AS_ADMIN,
        user: alice.user,
        context: alice.chainContext,
      })

      // 👩🏾 🡒 👨🏻‍🦲 👳🏽‍♂️ Alice shares the chain with Bob and Charlie
      let bChain = clone(aChain)
      let cChain = clone(aChain)

      // 🔌❌ Now Bob and Charlie are disconnected

      // 👨🏻‍🦲 Bob removes Charlie
      bChain = append({
        chain: bChain,
        action: REMOVE_CHARLIE,
        user: bob.user,
        context: bob.chainContext,
      })

      // 👳🏽‍♂️ Charlie removes Bob
      cChain = append({
        chain: cChain,
        action: REMOVE_BOB,
        user: charlie.user,
        context: charlie.chainContext,
      })

      // 🔌✔ Bob and Charlie reconnect and synchronize chains

      // ✅ Bob was added first; Charlie's change is discarded, Bob stays
      expectMergedResult(bChain, cChain, 'ROOT, ADD:bob, ADD:charlie, REMOVE:charlie')
    })

    it('resolves mutual concurrent demotions in favor of the team founder', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob demotes Alice
      bChain = append({
        chain: bChain,
        action: DEMOTE_ALICE,
        user: bob.user,
        context: bob.chainContext,
      })

      // 👩🏾 Alice demotes Bob
      aChain = append({
        chain: aChain,
        action: DEMOTE_BOB,
        user: alice.user,
        context: alice.chainContext,
      })

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Alice created the team; Bob's change is discarded, Alice is still an admin
      expectMergedResult(aChain, bChain, 'ROOT, ADD:bob, REMOVE:admin:bob')
    })

    it('resolves circular mutual concurrent demotions in favor of the team founder', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and adds Charlie as admin
      let { aChain } = setup()
      aChain = append({
        chain: aChain,
        action: ADD_CHARLIE_AS_ADMIN,
        user: alice.user,
        context: alice.chainContext,
      })

      // 👩🏾 🡒 👨🏻‍🦲 Alice shares the chain with Bob and Charlie
      let bChain = clone(aChain)
      let cChain = clone(aChain)

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob demotes Charlie
      bChain = append({
        chain: bChain,
        action: DEMOTE_CHARLIE,
        user: bob.user,
        context: bob.chainContext,
      })

      // 👳🏽‍♂️ Charlie demotes Alice
      cChain = append({
        chain: cChain,
        action: DEMOTE_ALICE,
        user: charlie.user,
        context: charlie.chainContext,
      })

      // 👩🏾 Alice demotes Bob
      aChain = append({
        chain: aChain,
        action: DEMOTE_BOB,
        user: alice.user,
        context: alice.chainContext,
      })

      // 🔌✔ All reconnect and synchronize chains
      // This could happen three different ways - make sure the result is the same in all cases
      const mergedChains = [
        merge(aChain, merge(cChain, bChain)),
        merge(bChain, merge(cChain, aChain)),
        merge(cChain, merge(aChain, bChain)),
      ]

      // ✅ Alice created the team; Bob's change is discarded, Alice is still an admin
      const expected = 'ROOT, ADD:bob, ADD:charlie, REMOVE:admin:bob'
      for (const chain of mergedChains) expect(sequence(chain)).toBe(expected)
    })
  })
})

const expectMergedResult = (
  aChain: TeamSignatureChain,
  bChain: TeamSignatureChain,
  expected: string[] | string
) => {
  if (!Array.isArray(expected)) expected = [expected] as string[] // coerce to array

  // 👩🏾 ⇄ 👨🏻‍🦲 They synchronize chains
  const mergedChain = merge(aChain, bChain)

  // The resolved sequence should match one of the provided options
  expect(expected).toContain(sequence(mergedChain))
}

const sequence = (chain: TeamSignatureChain) =>
  chainSummary(chain)
    .replace(/_MEMBER/g, '')
    .replace(/_ROLE/g, '')

const { alice, bob, charlie } = userSetup('alice', 'bob', 'charlie')

// constant actions

const REMOVE_ALICE = {
  type: 'REMOVE_MEMBER',
  payload: { userName: 'alice' },
} as TeamAction

const DEMOTE_ALICE = {
  type: 'REMOVE_MEMBER_ROLE',
  payload: { userName: 'alice', roleName: ADMIN },
} as TeamAction

const ADD_BOB_AS_ADMIN = {
  type: 'ADD_MEMBER',
  payload: { member: redactUser(bob.user), roles: [ADMIN] },
} as TeamAction

const REMOVE_BOB = {
  type: 'REMOVE_MEMBER',
  payload: { userName: 'bob' },
} as TeamAction

const DEMOTE_BOB = {
  type: 'REMOVE_MEMBER_ROLE',
  payload: { userName: 'bob', roleName: ADMIN },
} as TeamAction

const ADD_CHARLIE = {
  type: 'ADD_MEMBER',
  payload: { member: redactUser(charlie.user) },
} as TeamAction

const ADD_CHARLIE_AS_ADMIN = {
  type: 'ADD_MEMBER',
  payload: { member: redactUser(charlie.user), roles: [ADMIN] },
} as TeamAction

const REMOVE_CHARLIE = {
  type: 'REMOVE_MEMBER',
  payload: { userName: 'charlie' },
} as TeamAction

const DEMOTE_CHARLIE = {
  type: 'REMOVE_MEMBER_ROLE',
  payload: { userName: 'charlie', roleName: ADMIN },
} as TeamAction

const ADD_ROLE_MANAGERS = {
  type: 'ADD_ROLE',
  payload: { roleName: 'managers' },
} as TeamAction
