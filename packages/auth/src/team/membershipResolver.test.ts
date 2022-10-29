import { ADMIN } from '@/role'
import { graphSummary, clone } from '@/util'
import { setup as userSetup } from '@/util/testing'
import { append, merge } from 'crdx'
import { createTeam } from './createTeam'
import { redactUser } from './redactUser'
import { TeamAction, TeamGraph } from './types'

describe('membershipResolver', () => {
  const setup = () => {
    // 👩🏾 Alice creates a graph
    let aTeam = createTeam('Spies Я Us', alice.localContext)
    let aGraph = aTeam.graph
    let teamKeys = aTeam.teamKeys()

    // 👩🏾 Alice adds 👨🏻‍🦲 Bob as admin
    aGraph = append({
      graph: aGraph,
      action: ADD_BOB_AS_ADMIN,
      user: alice.user,
      context: alice.graphContext,
      graphKeys: teamKeys,
    })

    // 👩🏾 🡒 👨🏻‍🦲 Alice shares the graph with Bob
    let bGraph: TeamGraph = clone(aGraph)
    return { aGraph, bGraph, teamKeys }
  }

  it('resolves two graphs with no conflicting membership changes', () => {
    // 👩🏾 🡒 👨🏻‍🦲 Alice creates a graph and shares it with Bob
    let { aGraph, bGraph, teamKeys } = setup()

    // 🔌❌ Now Alice and Bob are disconnected

    // 👨🏻‍🦲 Bob makes a change
    bGraph = append({
      graph: bGraph,
      action: ADD_ROLE_MANAGERS,
      user: bob.user,
      context: bob.graphContext,
      graphKeys: teamKeys,
    })
    expect(summary(bGraph)).toEqual('ROOT,ADD:bob,ADD:managers')

    // 👩🏾 Concurrently,Alice makes a change
    aGraph = append({
      graph: aGraph,
      action: ADD_CHARLIE,
      user: alice.user,
      context: alice.graphContext,
      graphKeys: teamKeys,
    })
    expect(summary(aGraph)).toEqual('ROOT,ADD:bob,ADD:charlie')

    // 🔌✔ Alice and Bob reconnect and synchronize graphs

    // ✅ the result will be one of these two (could be either because timestamps change with each test run)
    expectMergedResult(aGraph, bGraph, [
      'ROOT,ADD:bob,ADD:charlie,ADD:managers',
      'ROOT,ADD:bob,ADD:managers,ADD:charlie',
    ])
  })

  it('discards changes made by a member who is concurrently removed', () => {
    // 👩🏾 🡒 👨🏻‍🦲 Alice creates a graph and shares it with Bob
    let { aGraph, bGraph, teamKeys } = setup()

    // 🔌❌ Now Alice and Bob are disconnected

    // 👨🏻‍🦲 Bob adds Charlie to the group
    bGraph = append({
      graph: bGraph,
      action: ADD_CHARLIE,
      user: bob.user,
      context: bob.graphContext,
      graphKeys: teamKeys,
    })
    expect(summary(bGraph)).toEqual('ROOT,ADD:bob,ADD:charlie')

    // 👩🏾 but concurrently,Alice removes Bob from the group
    aGraph = append({
      graph: aGraph,
      action: REMOVE_BOB,
      user: alice.user,
      context: alice.graphContext,
      graphKeys: teamKeys,
    })
    expect(summary(aGraph)).toEqual('ROOT,ADD:bob,REMOVE:bob')

    // 🔌✔ Alice and Bob reconnect and synchronize graphs

    // ✅ Bob's change is discarded - Charlie is not added
    expectMergedResult(aGraph, bGraph, 'ROOT,ADD:bob,REMOVE:bob')
  })

  it('discards changes made by a member who is concurrently demoted', () => {
    // 👩🏾 🡒 👨🏻‍🦲 Alice creates a graph and shares it with Bob
    let { aGraph, bGraph, teamKeys } = setup()

    // 🔌❌ Now Alice and Bob are disconnected

    // 👨🏻‍🦲 Bob adds Charlie to the group
    bGraph = append({
      graph: bGraph,
      action: ADD_CHARLIE,
      user: bob.user,
      context: bob.graphContext,
      graphKeys: teamKeys,
    })
    expect(summary(bGraph)).toEqual('ROOT,ADD:bob,ADD:charlie')

    // 👩🏾 but concurrently,Alice removes Bob from the admin role
    aGraph = append({
      graph: aGraph,
      action: DEMOTE_BOB,
      user: alice.user,
      context: alice.graphContext,
      graphKeys: teamKeys,
    })
    expect(summary(aGraph)).toEqual('ROOT,ADD:bob,REMOVE:admin:bob')

    // 🔌✔ Alice and Bob reconnect and synchronize graphs

    // ✅ Bob's change is discarded
    expectMergedResult(aGraph, bGraph, 'ROOT,ADD:bob,REMOVE:admin:bob')
  })

  // TODO: This doesn't really tell us anything since it doesn't cover INVITE_MEMBER, which is how
  // members are actually added
  it(`doesn't allow a member who is removed to be concurrently added back`, () => {
    // 👩🏾 Alice creates a graph and adds Charlie
    let { aGraph, teamKeys } = setup()

    aGraph = append({
      graph: aGraph,
      action: ADD_CHARLIE,
      user: alice.user,
      context: alice.graphContext,
      graphKeys: teamKeys,
    })

    // 👩🏾 🡒 👨🏻‍🦲 Alice shares the graph with Bob
    let bGraph = clone(aGraph)

    // 🔌❌ Now Alice and Bob are disconnected

    // 👩🏾 Alice removes Charlie
    aGraph = append({
      graph: aGraph,
      action: REMOVE_CHARLIE,
      user: alice.user,
      context: alice.graphContext,
      graphKeys: teamKeys,
    })
    expect(summary(aGraph)).toEqual('ROOT,ADD:bob,ADD:charlie,REMOVE:charlie')

    // 👨🏻‍🦲 Bob removes Charlie then adds him back
    bGraph = append({
      graph: bGraph,
      action: REMOVE_CHARLIE,
      user: bob.user,
      context: bob.graphContext,
      graphKeys: teamKeys,
    })
    bGraph = append({
      graph: bGraph,
      action: ADD_CHARLIE,
      user: bob.user,
      context: bob.graphContext,
      graphKeys: teamKeys,
    })
    expect(summary(bGraph)).toEqual('ROOT,ADD:bob,ADD:charlie,REMOVE:charlie,ADD:charlie')

    // 🔌✔ Alice and Bob reconnect and synchronize graphs

    // ✅ Charlie isn't added back
    expectMergedResult(aGraph, bGraph, 'ROOT,ADD:bob,ADD:charlie,REMOVE:charlie,REMOVE:charlie')
  })

  it('resolves mutual concurrent removals in favor of the team founder', () => {
    // 👩🏾 🡒 👨🏻‍🦲 Alice creates a graph and shares it with Bob
    let { aGraph, bGraph, teamKeys } = setup()

    // 🔌❌ Now Alice and Bob are disconnected

    // 👨🏻‍🦲 Bob removes Alice
    bGraph = append({
      graph: bGraph,
      action: REMOVE_ALICE,
      user: bob.user,
      context: bob.graphContext,
      graphKeys: teamKeys,
    })

    // 👩🏾 Alice removes Bob
    aGraph = append({
      graph: aGraph,
      action: REMOVE_BOB,
      user: alice.user,
      context: alice.graphContext,
      graphKeys: teamKeys,
    })

    // 🔌✔ Alice and Bob reconnect and synchronize graphs

    // ✅ Alice created the team; Bob's change is discarded,Alice stays
    expectMergedResult(aGraph, bGraph, 'ROOT,ADD:bob,REMOVE:bob')
  })

  it('resolves mutual concurrent removals in favor of the senior member', () => {
    // 👩🏾 Alice creates a graph and adds Charlie
    let { aGraph, teamKeys } = setup()

    aGraph = append({
      graph: aGraph,
      action: ADD_CHARLIE_AS_ADMIN,
      user: alice.user,
      context: alice.graphContext,
      graphKeys: teamKeys,
    })

    // 👩🏾 🡒 👨🏻‍🦲 👳🏽‍♂️ Alice shares the graph with Bob and Charlie
    let bGraph = clone(aGraph)
    let cGraph = clone(aGraph)

    // 🔌❌ Now Bob and Charlie are disconnected

    // 👨🏻‍🦲 Bob removes Charlie
    bGraph = append({
      graph: bGraph,
      action: REMOVE_CHARLIE,
      user: bob.user,
      context: bob.graphContext,
      graphKeys: teamKeys,
    })

    // 👳🏽‍♂️ Charlie removes Bob
    cGraph = append({
      graph: cGraph,
      action: REMOVE_BOB,
      user: charlie.user,
      context: charlie.graphContext,
      graphKeys: teamKeys,
    })

    // 🔌✔ Bob and Charlie reconnect and synchronize graphs

    // ✅ Bob was added first; Charlie's change is discarded,Bob stays
    expectMergedResult(bGraph, cGraph, 'ROOT,ADD:bob,ADD:charlie,REMOVE:charlie')
  })

  it('resolves mutual concurrent demotions in favor of the team founder', () => {
    // 👩🏾 🡒 👨🏻‍🦲 Alice creates a graph and shares it with Bob
    let { aGraph, bGraph, teamKeys } = setup()

    // 🔌❌ Now Alice and Bob are disconnected

    // 👨🏻‍🦲 Bob demotes Alice
    bGraph = append({
      graph: bGraph,
      action: DEMOTE_ALICE,
      user: bob.user,
      context: bob.graphContext,
      graphKeys: teamKeys,
    })

    // 👩🏾 Alice demotes Bob
    aGraph = append({
      graph: aGraph,
      action: DEMOTE_BOB,
      user: alice.user,
      context: alice.graphContext,
      graphKeys: teamKeys,
    })

    // 🔌✔ Alice and Bob reconnect and synchronize graphs

    // ✅ Alice created the team; Bob's change is discarded,Alice is still an admin
    expectMergedResult(aGraph, bGraph, 'ROOT,ADD:bob,REMOVE:admin:bob')
  })

  it('resolves circular mutual concurrent demotions in favor of the team founder', () => {
    // 👩🏾 🡒 👨🏻‍🦲 Alice creates a graph and adds Charlie as admin
    let { aGraph, teamKeys } = setup()

    aGraph = append({
      graph: aGraph,
      action: ADD_CHARLIE_AS_ADMIN,
      user: alice.user,
      context: alice.graphContext,
      graphKeys: teamKeys,
    })

    // 👩🏾 🡒 👨🏻‍🦲 Alice shares the graph with Bob and Charlie
    let bGraph = clone(aGraph)
    let cGraph = clone(aGraph)

    // 🔌❌ Now Alice and Bob are disconnected

    // 👨🏻‍🦲 Bob demotes Charlie
    bGraph = append({
      graph: bGraph,
      action: DEMOTE_CHARLIE,
      user: bob.user,
      context: bob.graphContext,
      graphKeys: teamKeys,
    })

    // 👳🏽‍♂️ Charlie demotes Alice
    cGraph = append({
      graph: cGraph,
      action: DEMOTE_ALICE,
      user: charlie.user,
      context: charlie.graphContext,
      graphKeys: teamKeys,
    })

    // 👩🏾 Alice demotes Bob
    aGraph = append({
      graph: aGraph,
      action: DEMOTE_BOB,
      user: alice.user,
      context: alice.graphContext,
      graphKeys: teamKeys,
    })

    // 🔌✔ All reconnect and synchronize graphs
    // This could happen three different ways - make sure the result is the same in all cases
    const mergedGraphs = [
      merge(aGraph, merge(cGraph, bGraph)),
      merge(bGraph, merge(cGraph, aGraph)),
      merge(cGraph, merge(aGraph, bGraph)),
    ]

    // ✅ Alice created the team; Bob's change is discarded,Alice is still an admin
    const expected = 'ROOT,ADD:bob,ADD:charlie,REMOVE:admin:bob'
    for (const graph of mergedGraphs) expect(summary(graph)).toBe(expected)
  })

  const expectMergedResult = (
    aGraph: TeamGraph,
    bGraph: TeamGraph,
    expected: string[] | string
  ) => {
    // 👩🏾 ⇄ 👨🏻‍🦲 They synchronize graphs
    const mergedGraph = merge(aGraph, bGraph)

    if (!Array.isArray(expected)) {
      expect(summary(mergedGraph)).toBe(expected)
    } else {
      // The resolved sequence should match one of the provided options
      expect(expected).toContain(summary(mergedGraph))
    }
  }

  const summary = (graph: TeamGraph) =>
    graphSummary(graph)
      .replace(/_MEMBER/g, '')
      .replace(/_ROLE/g, '')

  const { alice, bob, charlie } = userSetup('alice', 'bob', 'charlie')

  // constant actions

  const REMOVE_ALICE = {
    type: 'REMOVE_MEMBER',
    payload: { userId: 'alice' },
  } as TeamAction

  const DEMOTE_ALICE = {
    type: 'REMOVE_MEMBER_ROLE',
    payload: { userId: 'alice', roleName: ADMIN },
  } as TeamAction

  const ADD_BOB_AS_ADMIN = {
    type: 'ADD_MEMBER',
    payload: { member: redactUser(bob.user), roles: [ADMIN] },
  } as TeamAction

  const REMOVE_BOB = {
    type: 'REMOVE_MEMBER',
    payload: { userId: 'bob' },
  } as TeamAction

  const DEMOTE_BOB = {
    type: 'REMOVE_MEMBER_ROLE',
    payload: { userId: 'bob', roleName: ADMIN },
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
    payload: { userId: 'charlie' },
  } as TeamAction

  const DEMOTE_CHARLIE = {
    type: 'REMOVE_MEMBER_ROLE',
    payload: { userId: 'charlie', roleName: ADMIN },
  } as TeamAction

  const ADD_ROLE_MANAGERS = {
    type: 'ADD_ROLE',
    payload: { roleName: 'managers' },
  } as TeamAction

  const ADD_CHARLIE_TO_MANAGERS = {
    type: 'ADD_MEMBER_ROLE',
    payload: { userId: 'charlie', roleName: 'managers' },
  } as TeamAction

  /**
          TODO simulate this situation from connection.test
          20201229 OK. What's happening here is that sometimes (50% of the time?) when we eliminate duplicate
          ADD_MEMBERs,we're eliminating one that would have needed to have come BEFORE something else,
          in this case the CHANGE_MEMBER_KEYs action that happens after that person is admitted.
          Here's an example of a bad graph that you can end up with that way:
            👩🏾 ROOT
            ADD_MEMBER:👨‍🦲
                                                                      <== ADD_MEMBER:👳🏽‍♂️ was removed from here
            INVITE:kPFx4gwGpuWplwa
            INVITE:tiKXBLLdMbDndJE
            ADMIT:👳🏽‍♂️
            CHANGE_MEMBER_KEYS:{"type":"MEMBER","name":"👳🏽‍♂️",...}    <== we can't do this because 👳🏽‍♂️ hasn't been added yet
            ADD_DEVICE:👳🏽‍♂️:laptop
            ADD_MEMBER:👳🏽‍♂️
            INVITE:dQRE52A+7UGr8X9
            ADD_MEMBER:👴
            INVITE:j6cC8ZyjyhuojZw
            ADMIT:👴
            CHANGE_MEMBER_KEYS:{"type":"MEMBER","name":"👴",...}
            ADD_DEVICE:👴:laptop
          Here's how that graph should have been resolved:
            👩🏾 ROOT
            ADD_MEMBER:👨‍🦲
            ADD_MEMBER:👳🏽‍♂️                                             <== in the bad graph,this ADD_MEMBER was discarded as a duplicate
            INVITE:fNpSg0uBcW1vYvf
            ADD_MEMBER:👴
            INVITE:PkD7SISvUt/3YlJ
            ADMIT:👳🏽‍♂️
            CHANGE_MEMBER_KEYS:{"type":"MEMBER","name":"👳🏽‍♂️",...}
            ADD_DEVICE:👳🏽‍♂️:laptop
                                                                      <== ADD_MEMBER:👳🏽‍♂️ was removed from here
            INVITE:Pu6NaY6HfbITAf6
            INVITE:7vVS0NXz+u15Mx2
            ADMIT:👴
            CHANGE_MEMBER_KEYS:{"type":"MEMBER","name":"👴",...}
            ADD_DEVICE:👴:laptop
        */
})
