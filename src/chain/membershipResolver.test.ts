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
import { alice, alicesContext, bob, bobsContext, charlie, charliesContext } from '/util/testing'

describe('teams', () => {
  describe('strongRemoveResolver', () => {
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
      expected: string[][] | string[]
    ) => {
      // 👩🏾 ⇄ 👨🏻‍🦲 They synchronize chains
      bChain = merge(bChain, aChain)
      aChain = merge(aChain, bChain)

      // 👩🏾 == 👨🏻‍🦲 They should now end up with the same sequence
      const aSequence = sequence(aChain)
      const bSequence = sequence(bChain)
      expect(aSequence).toEqual(bSequence)

      // `expected` can be one sequence or multiple sequence options
      if (!Array.isArray(expected[0])) expected = [expected] as string[][] // coerce to array of sequences

      // The sequence should match one of the provided options
      expect(expected).toContainEqual(aSequence)
    }

    it('should resolve two chains with no conflicting membership changes', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob makes a change
      bChain = append(bChain, ADD_ROLE_MANAGERS, bobsContext)
      expect(sequence(bChain)).toEqual(['ROOT', 'ADD b', 'ADD managers'])

      // 👩🏾 Concurrently, Alice makes a change
      aChain = append(aChain, ADD_CHARLIE, alicesContext)
      expect(sequence(aChain)).toEqual(['ROOT', 'ADD b', 'ADD c'])

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ the result will be one of these two (could be either because timestamps change with each test run)
      expectMergedResult(aChain, bChain, [
        ['ROOT', 'ADD b', 'ADD c', 'ADD managers'],
        ['ROOT', 'ADD b', 'ADD managers', 'ADD c'],
      ])
    })

    it('should discard changes made by a member who is concurrently removed', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob adds Charlie to the group
      bChain = append(bChain, ADD_CHARLIE, bobsContext)
      expect(sequence(bChain)).toEqual(['ROOT', 'ADD b', 'ADD c'])

      // 👩🏾 but concurrently, Alice removes Bob from the group
      aChain = append(aChain, REMOVE_BOB, alicesContext)
      expect(sequence(aChain)).toEqual(['ROOT', 'ADD b', 'REMOVE b'])

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Bob's change is discarded - Charlie is not added
      expectMergedResult(aChain, bChain, ['ROOT', 'ADD b', 'REMOVE b'])
    })

    it('should discard changes made by a member who is concurrently demoted', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob adds Charlie to the group
      bChain = append(bChain, ADD_CHARLIE, bobsContext)
      expect(sequence(bChain)).toEqual(['ROOT', 'ADD b', 'ADD c'])

      // 👩🏾 but concurrently, Alice removes Bob from the admin role
      aChain = append(aChain, DEMOTE_BOB, alicesContext)
      expect(sequence(aChain)).toEqual(['ROOT', 'ADD b', 'REMOVE admin b'])

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Bob's change is discarded
      expectMergedResult(aChain, bChain, ['ROOT', 'ADD b', 'REMOVE admin b'])
    })

    it('should discard duplicate changes', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob adds Charlie
      bChain = append(bChain, ADD_CHARLIE, bobsContext)
      expect(sequence(bChain)).toEqual(['ROOT', 'ADD b', 'ADD c'])

      // 👩🏾 concurrently, Alice also adds Charlie
      aChain = append(aChain, ADD_CHARLIE, alicesContext)
      expect(sequence(aChain)).toEqual(['ROOT', 'ADD b', 'ADD c'])

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Only one of the add actions is kept (we don't care which)
      expectMergedResult(aChain, bChain, ['ROOT', 'ADD b', 'ADD c'])
    })

    it(`shouldn't allow a member who is removed to be concurrently added back`, () => {
      // 👩🏾 Alice creates a chain and adds Charlie
      let { aChain } = setup()
      aChain = append(aChain, ADD_CHARLIE, alicesContext)

      // 👩🏾 🡒 👨🏻‍🦲 Alice shares the chain with Bob
      let bChain = clone(aChain)

      // 🔌❌ Now Alice and Bob are disconnected

      // 👩🏾 Alice removes Charlie
      aChain = append(aChain, REMOVE_CHARLIE, alicesContext)
      expect(sequence(aChain)).toEqual(['ROOT', 'ADD b', 'ADD c', 'REMOVE c'])

      // 👨🏻‍🦲 Bob removes Charlie then adds him back
      bChain = append(bChain, REMOVE_CHARLIE, bobsContext)
      bChain = append(bChain, ADD_CHARLIE, bobsContext)
      expect(sequence(bChain)).toEqual(['ROOT', 'ADD b', 'ADD c', 'REMOVE c', 'ADD c'])

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Charlie isn't added back
      expectMergedResult(aChain, bChain, ['ROOT', 'ADD b', 'ADD c', 'REMOVE c'])
    })

    it('should resolve mutual concurrent removals in favor of the team founder', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob removes Alice
      bChain = append(bChain, REMOVE_ALICE, bobsContext)

      // 👩🏾 Alice removes Bob
      aChain = append(aChain, REMOVE_BOB, alicesContext)

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Alice created the team; Bob's change is discarded, Alice stays
      expectMergedResult(aChain, bChain, ['ROOT', 'ADD b', 'REMOVE b'])
    })

    it('should resolve mutual concurrent removals in favor of the senior member', () => {
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
      expectMergedResult(bChain, cChain, ['ROOT', 'ADD b', 'ADD c', 'REMOVE c'])
    })
  })
})

// utility function to get a chain's sequence using `strongRemoveResolver`
// and represent it as an array of strings
const sequence = (chain: TeamSignatureChain) =>
  getSequence({ chain, resolver: membershipResolver }).map((l: TeamActionLink) => {
    const summary =
      l.body.type === 'ADD_MEMBER'
        ? l.body.payload.member.userName[0]
        : l.body.type === 'REMOVE_MEMBER'
        ? l.body.payload.userName[0]
        : l.body.type === 'ADD_ROLE'
        ? l.body.payload.roleName
        : l.body.type === 'ADD_MEMBER_ROLE'
        ? l.body.payload.roleName
        : l.body.type === 'REMOVE_MEMBER_ROLE'
        ? `${l.body.payload.roleName} ${l.body.payload.userName[0]}`
        : ''
    return `${l.body.type} ${summary}`.trim().replace('_MEMBER', '').replace('_ROLE', '')
  })

// constant actions

const REMOVE_ALICE = {
  type: 'REMOVE_MEMBER',
  payload: { userName: 'alice' },
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

const ADD_ROLE_MANAGERS = {
  type: 'ADD_ROLE',
  payload: { roleName: 'managers' },
} as TeamAction
