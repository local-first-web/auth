import { setup as userSetup } from '@/util/testing'
import { append, chainSummary, create, merge, TeamAction, TeamSignatureChain } from '@/chain'
import { ADMIN } from '@/role'
import { redactUser } from '@/user'
import { clone } from '@/util'

describe('chains', () => {
  describe('membershipSequencer', () => {
    it('discards duplicate changes', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob adds Charlie
      bChain = append(bChain, ADD_CHARLIE, bob.localContext)
      expect(sequence(bChain)).toEqual('ROOT, ADD:bob, ADD:charlie')

      // 👩🏾 concurrently, Alice also adds Charlie
      aChain = append(aChain, ADD_CHARLIE, alice.localContext)
      expect(sequence(aChain)).toEqual('ROOT, ADD:bob, ADD:charlie')

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Only one of the add actions is kept (we don't care which)
      expectMergedResult(aChain, bChain, 'ROOT, ADD:bob, ADD:charlie')
    })

    it('discards duplicate removals', () => {
      // 👩🏾 Alice creates a chain and adds Charlie
      let { aChain } = setup()
      aChain = append(aChain, ADD_CHARLIE, alice.localContext)

      // 👩🏾 🡒 👨🏻‍🦲 Alice shares the chain with Bob
      let bChain = clone(aChain)

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob removes Charlie
      bChain = append(bChain, REMOVE_CHARLIE, bob.localContext)
      expect(sequence(bChain)).toEqual('ROOT, ADD:bob, ADD:charlie, REMOVE:charlie')

      // 👩🏾 concurrently, Alice also removes Charlie
      aChain = append(aChain, REMOVE_CHARLIE, alice.localContext)
      expect(sequence(aChain)).toEqual('ROOT, ADD:bob, ADD:charlie, REMOVE:charlie')

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Only one of the add actions is kept (we don't care which)
      expectMergedResult(aChain, bChain, 'ROOT, ADD:bob, ADD:charlie, REMOVE:charlie')
    })

    // TODO simulate this situation from connection.test

    // 20201229 OK. What's happening here is that sometimes (50% of the time?) when we eliminate duplicate
    // ADD_MEMBERs, we're eliminating one that would have needed to have come BEFORE something else,
    // in this case the CHANGE_MEMBER_KEYs action that happens after that person is admitted.

    // Here's an example of a bad chain that you can end up with that way:
    //    👩🏾 ROOT
    //    ADD_MEMBER:👨‍🦲
    //                                                              <== ADD_MEMBER:👳🏽‍♂️ was removed from here
    //    INVITE:kPFx4gwGpuWplwa
    //    INVITE:tiKXBLLdMbDndJE
    //    ADMIT:👳🏽‍♂️
    //    CHANGE_MEMBER_KEYS:{"type":"MEMBER","name":"👳🏽‍♂️", ...}    <== we can't do this because 👳🏽‍♂️ hasn't been added yet
    //    ADD_DEVICE:👳🏽‍♂️:laptop
    //    ADD_MEMBER:👳🏽‍♂️
    //    INVITE:dQRE52A+7UGr8X9
    //    ADD_MEMBER:👴
    //    INVITE:j6cC8ZyjyhuojZw
    //    ADMIT:👴
    //    CHANGE_MEMBER_KEYS:{"type":"MEMBER","name":"👴", ...}
    //    ADD_DEVICE:👴:laptop

    // Here's how that chain should have been resolved:
    //    👩🏾 ROOT
    //    ADD_MEMBER:👨‍🦲
    //    ADD_MEMBER:👳🏽‍♂️                                             <== in the bad chain, this ADD_MEMBER was discarded as a duplicate
    //    INVITE:fNpSg0uBcW1vYvf
    //    ADD_MEMBER:👴
    //    INVITE:PkD7SISvUt/3YlJ
    //    ADMIT:👳🏽‍♂️
    //    CHANGE_MEMBER_KEYS:{"type":"MEMBER","name":"👳🏽‍♂️", ...}
    //    ADD_DEVICE:👳🏽‍♂️:laptop
    //                                                              <== ADD_MEMBER:👳🏽‍♂️ was removed from here
    //    INVITE:Pu6NaY6HfbITAf6
    //    INVITE:7vVS0NXz+u15Mx2
    //    ADMIT:👴
    //    CHANGE_MEMBER_KEYS:{"type":"MEMBER","name":"👴", ...}
    //    ADD_DEVICE:👴:laptop

    it('keeps the earliest instance in case of duplicates', () => {
      // 👩🏾 🡒 👨🏻‍🦲 Alice creates a chain and shares it with Bob
      let { aChain, bChain } = setup()

      // 🔌❌ Now Alice and Bob are disconnected

      // 👨🏻‍🦲 Bob adds Charlie
      bChain = append(bChain, ADD_CHARLIE, bob.localContext)
      expect(sequence(bChain)).toEqual('ROOT, ADD:bob, ADD:charlie')

      // 👩🏾 concurrently, Alice also adds Charlie and makes him a manager
      aChain = append(aChain, ADD_ROLE_MANAGERS, alice.localContext)
      aChain = append(aChain, ADD_CHARLIE, alice.localContext)
      aChain = append(aChain, ADD_CHARLIE_TO_MANAGERS, alice.localContext)
      expect(sequence(aChain)).toEqual(
        'ROOT, ADD:bob, ADD:managers, ADD:charlie, ADD:managers:charlie'
      )

      // 🔌✔ Alice and Bob reconnect and synchronize chains

      // ✅ Only the first add action is kept;
      //    Charlie is never added * after * he is made manager
      expectMergedResult(aChain, bChain, [
        'ROOT, ADD:bob, ADD:charlie, ADD:managers, ADD:managers:charlie',
        'ROOT, ADD:bob, ADD:managers, ADD:charlie, ADD:managers:charlie',
      ])
    })

    const setup = () => {
      // 👩🏾 Alice creates a chain
      let aChain = create<TeamAction>(
        { teamName: 'Spies Я Us', rootMember: redactUser(alice.user) },
        alice.localContext
      )
      // 👩🏾 Alice adds 👨🏻‍🦲 Bob as admin
      aChain = append(aChain, ADD_BOB_AS_ADMIN, alice.localContext)

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
      const mergedChain = merge(aChain, bChain)

      // The resolved sequence should match one of the provided options
      expect(expected).toContain(sequence(mergedChain))
    }

    const sequence = (chain: TeamSignatureChain) =>
      chainSummary(chain)
        .replace(/_MEMBER/g, '')
        .replace(/_ROLE/g, '')
  })

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

  const ADD_CHARLIE_TO_MANAGERS = {
    type: 'ADD_MEMBER_ROLE',
    payload: { userName: 'charlie', roleName: 'managers' },
  } as TeamAction
})
