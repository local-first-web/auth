import { append, clone, create, getSequence, merge } from '/chain'
import { ADMIN } from '/role'
import { strongRemoveResolver } from '/team/strongRemoveResolver'
import { TeamAction, TeamActionLink, TeamSignatureChain } from '/team/types'
import { redactUser } from '/user'
import { alice, alicesContext, bob, bobsContext, charlie, MANAGERS } from '/util/testing'

describe('teams', () => {
  describe('strongRemoveResolver', () => {
    const setup = () => {
      // 👩🏾 Alice creates a chain
      let aliceChain = create<TeamAction>(
        { teamName: 'Spies Я Us', rootMember: redactUser(alice) },
        alicesContext
      )
      // 👩🏾 Alice adds 👨‍🦲 Bob as admin
      aliceChain = append(aliceChain, ADD_BOB, alicesContext)

      // 👩🏾 🡒 👨‍🦲 Alice shares the chain with Bob
      let bobChain = clone(aliceChain)
      return { aliceChain, bobChain }
    }

    const expectMergedResult = (
      aChain: TeamSignatureChain,
      bChain: TeamSignatureChain,
      expected: string[][] | string[]
    ) => {
      // 👩🏾 ⇄ 👨‍🦲 They synchronize chains
      bChain = merge(bChain, aChain)
      aChain = merge(aChain, bChain)

      // 👩🏾 == 👨‍🦲 They should now end up with the same sequence
      const aSequence = sequence(aChain)
      const bSequence = sequence(bChain)
      expect(aSequence).toEqual(bSequence)

      // `expected` can be one sequence or multiple sequence options
      // coerce to array of sequences
      if (!Array.isArray(expected[0])) expected = [expected] as string[][]

      // The sequence should match one of the provided options
      expect(expected).toContainEqual(aSequence)
    }

    it('should resolve two chains with no conflicting membership changes', () => {
      // 👩🏾 🡒 👨‍🦲 Alice creates a chain and shares it with Bob
      let { aliceChain, bobChain } = setup()

      // 🔌 Now Alice and Bob are disconnected

      // 👨‍🦲 Bob makes a change
      bobChain = append(bobChain, ADD_ROLE_MANAGERS, bobsContext)
      expect(sequence(bobChain)).toEqual(['ROOT', 'ADD bob', 'ADD MANAGERS'])

      // 👩🏾 Concurrently, Alice makes a change
      aliceChain = append(aliceChain, ADD_CHARLIE, alicesContext)
      expect(sequence(aliceChain)).toEqual(['ROOT', 'ADD bob', 'ADD charlie'])

      // 🔄 Alice and Bob reconnect and synchronize chains

      // ✅ the result will be one of these two (could be either because timestamps change with each test run)
      expectMergedResult(aliceChain, bobChain, [
        ['ROOT', 'ADD bob', 'ADD charlie', 'ADD MANAGERS'],
        ['ROOT', 'ADD bob', 'ADD MANAGERS', 'ADD charlie'],
      ])
    })

    it('should discard changes made by a member who is concurrently removed', () => {
      // 👩🏾 🡒 👨‍🦲 Alice creates a chain and shares it with Bob
      let { aliceChain, bobChain } = setup()

      // 🔌 Now Alice and Bob are disconnected

      // 👨‍🦲 Bob makes a change
      bobChain = append(bobChain, ADD_CHARLIE, bobsContext)
      expect(sequence(bobChain)).toEqual(['ROOT', 'ADD bob', 'ADD charlie'])

      // 👩🏾 but concurrently, Alice removes Bob from the admin role
      aliceChain = append(aliceChain, DEMOTE_BOB, alicesContext)
      expect(sequence(aliceChain)).toEqual(['ROOT', 'ADD bob', 'REMOVE admin bob'])

      // 🔄 Alice and Bob reconnect and synchronize chains

      // ✅ Bob's change is discarded
      expectMergedResult(aliceChain, bobChain, ['ROOT', 'ADD bob', 'REMOVE admin bob'])
    })

    it('should discard duplicate changes', () => {
      // 👩🏾 🡒 👨‍🦲 Alice creates a chain and shares it with Bob
      let { aliceChain, bobChain } = setup()

      // 🔌 Now Alice and Bob are disconnected

      // 👨‍🦲 Bob adds Charlie
      bobChain = append(bobChain, ADD_CHARLIE, bobsContext)
      expect(sequence(bobChain)).toEqual(['ROOT', 'ADD bob', 'ADD charlie'])

      // 👩🏾 concurrently, Alice also adds Charlie
      aliceChain = append(aliceChain, ADD_CHARLIE, alicesContext)
      expect(sequence(aliceChain)).toEqual(['ROOT', 'ADD bob', 'ADD charlie'])

      // 🔄 Alice and Bob reconnect and synchronize chains

      // ✅ Only one of the add actions is kept
      expectMergedResult(aliceChain, bobChain, ['ROOT', 'ADD bob', 'ADD charlie'])
    })

    it(`shouldn't allow a member who is removed to be concurrently added back`, () => {
      // 👩🏾 Alice creates a chain and adds Charlie
      let { aliceChain } = setup()
      aliceChain = append(aliceChain, ADD_CHARLIE, alicesContext)

      // 👩🏾 🡒 👨‍🦲 Alice shares the chain with Bob
      let bobChain = clone(aliceChain)

      // 🔌 Now Alice and Bob are disconnected

      // 👩🏾 Alice removes Charlie
      aliceChain = append(aliceChain, REMOVE_CHARLIE, alicesContext)
      expect(sequence(aliceChain)).toEqual([
        'ROOT', //
        'ADD bob',
        'ADD charlie',
        'REMOVE charlie',
      ])

      // 👨‍🦲 Bob removes Charlie then adds him back
      bobChain = append(bobChain, REMOVE_CHARLIE, bobsContext)
      bobChain = append(bobChain, ADD_CHARLIE, bobsContext)
      expect(sequence(bobChain)).toEqual([
        'ROOT',
        'ADD bob',
        'ADD charlie',
        'REMOVE charlie',
        'ADD charlie',
      ])

      // 🔄 Alice and Bob reconnect and synchronize chains

      // ✅ Charlie isn't added back
      expectMergedResult(aliceChain, bobChain, [
        'ROOT', //
        'ADD bob',
        'ADD charlie',
        'REMOVE charlie',
      ])
    })
  })
})

// utility function to get a chain's sequence using `strongRemoveResolver`
// and represent it as an array of strings
const sequence = (chain: TeamSignatureChain) =>
  getSequence({ chain, resolver: strongRemoveResolver }).map((l: TeamActionLink) => {
    const summary =
      l.body.type === 'ADD_MEMBER'
        ? l.body.payload.member.userName
        : l.body.type === 'REMOVE_MEMBER'
        ? l.body.payload.userName
        : l.body.type === 'ADD_ROLE'
        ? l.body.payload.roleName
        : l.body.type === 'ADD_MEMBER_ROLE'
        ? l.body.payload.roleName
        : l.body.type === 'REMOVE_MEMBER_ROLE'
        ? `${l.body.payload.roleName} ${l.body.payload.userName}`
        : ''
    return `${l.body.type} ${summary}`.trim().replace('_MEMBER', '').replace('_ROLE', '')
  })

// constant actions

const ADD_BOB = {
  type: 'ADD_MEMBER',
  payload: { member: redactUser(bob), roles: [ADMIN] },
} as TeamAction

const DEMOTE_BOB = {
  type: 'REMOVE_MEMBER_ROLE',
  payload: { userName: 'bob', roleName: ADMIN },
} as TeamAction

const ADD_CHARLIE = {
  type: 'ADD_MEMBER',
  payload: { member: redactUser(charlie) },
} as TeamAction

const REMOVE_CHARLIE = {
  type: 'REMOVE_MEMBER',
  payload: { userName: 'charlie' },
} as TeamAction

const ADD_ROLE_MANAGERS = {
  type: 'ADD_ROLE',
  payload: { roleName: 'MANAGERS' },
} as TeamAction
