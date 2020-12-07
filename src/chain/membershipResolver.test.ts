import {
  append,
  clone,
  create,
  getSequence,
  membershipResolver,
  merge,
  TeamAction,
  TeamActionLink,
  TeamSignatureChain,
} from '/chain'
import { ADMIN } from '/role'
import { redactUser } from '/user'
import { chainSummary } from '/util/chainSummary'
import { alice, alicesContext, bob, bobsContext, charlie, charliesContext } from '/util/testing'

describe('chains', () => {
  describe('strongRemoveResolver', () => {
    it('resolves two chains with no conflicting membership changes', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob makes a change
      bChain = append(bChain, ADD_ROLE_MANAGERS, bobsContext)
      expect(sequence(bChain)).toEqual('ROOT, ADD:bob, ADD:managers')

      // 👩🏾 Concurrently, Alice makes a change
      aChain = append(aChain, ADD_CHARLIE, alicesContext)
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
      bChain = append(bChain, ADD_CHARLIE, bobsContext)
      expect(sequence(bChain)).toEqual('ROOT, ADD:bob, ADD:charlie')

      // 👩🏾 but concurrently, Alice removes Bob from the group
      aChain = append(aChain, REMOVE_BOB, alicesContext)
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
      bChain = append(bChain, ADD_CHARLIE, bobsContext)
      expect(sequence(bChain)).toEqual('ROOT, ADD:bob, ADD:charlie')

      // 👩🏾 but concurrently, Alice removes Bob from the admin role
      aChain = append(aChain, DEMOTE_BOB, alicesContext)
      expect(sequence(aChain)).toEqual('ROOT, ADD:bob, REMOVE:admin:bob')

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Bob's change is discarded
      expectMergedResult(aChain, bChain, 'ROOT, ADD:bob, REMOVE:admin:bob')
    })

    it('discards duplicate changes', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob adds Charlie
      bChain = append(bChain, ADD_CHARLIE, bobsContext)
      expect(sequence(bChain)).toEqual('ROOT, ADD:bob, ADD:charlie')

      // 👩🏾 concurrently, Alice also adds Charlie
      aChain = append(aChain, ADD_CHARLIE, alicesContext)
      expect(sequence(aChain)).toEqual('ROOT, ADD:bob, ADD:charlie')

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Only one of the add actions is kept (we don't care which)
      expectMergedResult(aChain, bChain, 'ROOT, ADD:bob, ADD:charlie')
    })

    it('discards duplicate removals', () => {
      // 👩🏾 Alice creates a chain and adds Charlie
      let { aChain } = setup()
      aChain = append(aChain, ADD_CHARLIE, alicesContext)

      // 👩🏾 🡒 👨🏻‍🦲 Alice shares the chain with Bob
      let bChain = clone(aChain)

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob removes Charlie
      bChain = append(bChain, REMOVE_CHARLIE, bobsContext)
      expect(sequence(bChain)).toEqual('ROOT, ADD:bob, ADD:charlie, REMOVE:charlie')

      // 👩🏾 concurrently, Alice also removes Charlie
      aChain = append(aChain, REMOVE_CHARLIE, alicesContext)
      expect(sequence(aChain)).toEqual('ROOT, ADD:bob, ADD:charlie, REMOVE:charlie')

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Only one of the add actions is kept (we don't care which)
      expectMergedResult(aChain, bChain, 'ROOT, ADD:bob, ADD:charlie, REMOVE:charlie')
    })

    it(`doesn't allow a member who is removed to be concurrently added back`, () => {
      // 👩🏾 Alice creates a chain and adds Charlie
      let { aChain } = setup()
      aChain = append(aChain, ADD_CHARLIE, alicesContext)

      // 👩🏾 🡒 👨🏻‍🦲 Alice shares the chain with Bob
      let bChain = clone(aChain)

      // 🔌❌ Now Alice and Bob are disconnected

      // 👩🏾 Alice removes Charlie
      aChain = append(aChain, REMOVE_CHARLIE, alicesContext)
      expect(sequence(aChain)).toEqual('ROOT, ADD:bob, ADD:charlie, REMOVE:charlie')

      // 👨🏻‍🦲 Bob removes Charlie then adds him back
      bChain = append(bChain, REMOVE_CHARLIE, bobsContext)
      bChain = append(bChain, ADD_CHARLIE, bobsContext)
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
      bChain = append(bChain, REMOVE_ALICE, bobsContext)

      // 👩🏾 Alice removes Bob
      aChain = append(aChain, REMOVE_BOB, alicesContext)

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Alice created the team; Bob's change is discarded, Alice stays
      expectMergedResult(aChain, bChain, ['ROOT, ADD:bob, REMOVE:bob'])
    })

    it('resolves mutual concurrent removals in favor of the senior member', () => {
      // 👩🏾 Alice creates a chain and adds Charlie
      let { aChain } = setup()
      aChain = append(aChain, ADD_CHARLIE_AS_ADMIN, alicesContext)

      // 👩🏾 🡒 👨🏻‍🦲 👳🏽‍♂️ Alice shares the chain with Bob and Charlie
      let bChain = clone(aChain)
      let cChain = clone(aChain)

      // 🔌❌ Now Bob and Charlie are disconnected

      // 👨🏻‍🦲 Bob removes Charlie
      bChain = append(bChain, REMOVE_CHARLIE, bobsContext)

      // 👳🏽‍♂️ Charlie removes Bob
      cChain = append(cChain, REMOVE_BOB, charliesContext)

      // 🔌✔ Bob and Charlie reconnect and synchronize chains

      // ✅ Bob was added first; Charlie's change is discarded, Bob stays
      expectMergedResult(bChain, cChain, 'ROOT, ADD:bob, ADD:charlie, REMOVE:charlie')
    })

    it('resolves mutual concurrent demotions in favor of the team founder', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob demotes Alice
      bChain = append(bChain, DEMOTE_ALICE, bobsContext)

      // 👩🏾 Alice demotes Bob
      aChain = append(aChain, DEMOTE_BOB, alicesContext)

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Alice created the team; Bob's change is discarded, Alice is still an admin
      expectMergedResult(aChain, bChain, 'ROOT, ADD:bob, REMOVE:admin:bob')
    })

    it('resolves circular mutual concurrent demotions in favor of the team founder', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and adds Charlie as admin
      let { aChain } = setup()
      aChain = append(aChain, ADD_CHARLIE_AS_ADMIN, alicesContext)

      // 👩🏾 🡒 👨🏻‍🦲 Alice shares the chain with Bob and Charlie
      let bChain = clone(aChain)
      let cChain = clone(aChain)

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob demotes Charlie
      bChain = append(bChain, DEMOTE_CHARLIE, bobsContext)

      // 👳🏽‍♂️ Charlie demotes Alice
      cChain = append(cChain, DEMOTE_ALICE, charliesContext)

      // 👩🏾 Alice demotes Bob
      aChain = append(aChain, DEMOTE_BOB, alicesContext)

      // 🔌✔ All reconnect and synchronize chains
      const mergedChain = merge(aChain, merge(cChain, bChain)) // this passes
      // const mergedChain = merge(bChain, merge(cChain, aChain)) // this doesn't pass
      // const mergedChain = merge(cChain, merge(aChain, bChain)) // this doesn't pass

      // TODO: This isn't working right, it's strongly dependent on order. In theory you can have
      // three people doing things concurrently. In practice, we only resolve conflicts pairwise. So
      // a b c do stuff concurrently, but we either resolve a-b and then b-c, or b-c then a-b;
      // depending on who merges with who first, different actions will be treated as conflicting,
      // while others are treated as non-concurrent.
      //
      // Maybe rather than have `membershipResolver` compare two resolved sequences, it could take
      // the entire unresolved branch? Because for deletions/demotions, we need to see all of them,
      // not just the unresolved ones, in case we would resolve them differently

      // ✅ Alice created the team; Bob's change is discarded, Alice is still an admin
      expect(sequence(mergedChain)).toBe('ROOT, ADD:bob, ADD:charlie, REMOVE:admin:bob')
    })

    const setup = () => {
      // 👩🏾 Alice creates a chain
      let aChain = create<TeamAction>(
        { teamName: 'Spies Я Us', rootMember: redactUser(alice) },
        alicesContext
      )
      // 👩🏾 Alice adds 👨🏻‍🦲 Bob as admin
      aChain = append(aChain, ADD_BOB_AS_ADMIN, alicesContext)

      // 👩🏾 🡒 👨🏻‍🦲 Alice shares the chain with Bob
      let bChain = clone(aChain)
      return { aChain, bChain }
    }

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

    // and represent it as an array of strings
    const sequence = (chain: TeamSignatureChain) =>
      chainSummary(chain)
        .replace(/_MEMBER/g, '')
        .replace(/_ROLE/g, '')

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
      payload: { member: redactUser(bob), roles: [ADMIN] },
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
      payload: { member: redactUser(charlie) },
    } as TeamAction

    const ADD_CHARLIE_AS_ADMIN = {
      type: 'ADD_MEMBER',
      payload: { member: redactUser(charlie), roles: [ADMIN] },
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
  })
})
