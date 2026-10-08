import { createGraph, type RootAction } from '../../graph/index.js'
import { createStore } from '../index.js'
import { type Reducer } from '../types.js'
import { createUser } from '../../user/index.js'
import { TEST_GRAPH_KEYS as keys } from '../../util/testing/setup.js'
import { describe, expect, test } from 'vitest'

const alice = createUser('alice')
const bob = createUser('bob')

type TestAction =
  | RootAction
  | { type: 'INCREMENT'; payload: number }
  | { type: 'REFUSED'; payload: undefined }

type TestState = { value: number }

/**
 * Stands in for an application-level refusal: a link the application won't replay, which shows up
 * as a throw from the reducer. In `auth` this is any link the team reducer refuses — an ADD_ROLE
 * from a non-admin, say — but nothing here is auth-specific.
 */
const refusingReducer: Reducer<TestState, TestAction> = (state, link) => {
  const action = link.body
  switch (action.type) {
    case 'ROOT': {
      return { value: 0 }
    }

    case 'INCREMENT': {
      return { value: state.value + (action.payload ?? 1) }
    }

    case 'REFUSED': {
      throw new Error('this link is refused')
    }

    default: {
      // ignore coverage
      return state
    }
  }
}

/**
 * Bob's rules differ from Alice's: he'll happily write a link that she refuses. That asymmetry is
 * the situation a merge has to survive — a peer sends us something we won't replay.
 */
const permissiveReducer: Reducer<TestState, TestAction> = (state, link) =>
  link.body.type === 'REFUSED' ? state : refusingReducer(state, link)

/** Builds two stores over a shared root, so that one can merge the other's graph. */
const setup = () => {
  const graph = createGraph<TestAction>({ user: alice, name: 'test', keys })

  const aliceStore = createStore<TestState, TestAction, Record<string, unknown>>({
    user: alice,
    graph,
    reducer: refusingReducer,
    keys,
  })
  const bobStore = createStore<TestState, TestAction, Record<string, unknown>>({
    user: bob,
    graph,
    reducer: permissiveReducer,
    keys,
  })
  return { aliceStore, bobStore }
}

/** Rehydrates a store from serialized form, the way an application reloads from storage. */
const reload = (serialized: Uint8Array) =>
  createStore<TestState, TestAction, Record<string, unknown>>({
    user: alice,
    graph: serialized,
    reducer: refusingReducer,
    keys,
  })

describe('Store', () => {
  describe('merge', () => {
    test('ordinary merges still work', () => {
      const { aliceStore, bobStore } = setup()
      aliceStore.dispatch({ type: 'INCREMENT', payload: 1 })
      bobStore.dispatch({ type: 'INCREMENT', payload: 10 })

      aliceStore.merge(bobStore.getGraph())
      bobStore.merge(aliceStore.getGraph())

      expect(aliceStore.getState().value).toBe(11)
      expect(bobStore.getState().value).toBe(11)
      expect(aliceStore.getGraph().head).toEqual(bobStore.getGraph().head)
    })

    test('a link we refuse is still refused', () => {
      const { aliceStore, bobStore } = setup()
      bobStore.dispatch({ type: 'REFUSED', payload: undefined })

      expect(() => aliceStore.merge(bobStore.getGraph())).toThrow('this link is refused')
    })

    test('a refused merge leaves our graph untouched', () => {
      const { aliceStore, bobStore } = setup()
      aliceStore.dispatch({ type: 'INCREMENT', payload: 1 })
      const linkCount = Object.keys(aliceStore.getGraph().links).length
      const head = [...aliceStore.getGraph().head]
      // A snapshot, not the object the store is holding: comparing that with itself passes however
      // the merge mangled it, which would make this leg of the test say nothing at all
      const state = structuredClone(aliceStore.getState())

      bobStore.dispatch({ type: 'REFUSED', payload: undefined })
      expect(() => aliceStore.merge(bobStore.getGraph())).toThrow()

      expect(Object.keys(aliceStore.getGraph().links)).toHaveLength(linkCount)
      expect(aliceStore.getGraph().head).toEqual(head)
      expect(aliceStore.getState()).toEqual(state)
    })

    test('after a refused merge we can still save and reload', () => {
      const { aliceStore, bobStore } = setup()
      aliceStore.dispatch({ type: 'INCREMENT', payload: 1 })

      bobStore.dispatch({ type: 'REFUSED', payload: undefined })
      expect(() => aliceStore.merge(bobStore.getGraph())).toThrow()

      // this is the whole point: what we wrote is still something we can replay
      expect(reload(aliceStore.save()).getState().value).toBe(1)
    })

    test('after a refused merge, what we go on to write is still replayable', () => {
      const { aliceStore, bobStore } = setup()

      bobStore.dispatch({ type: 'REFUSED', payload: undefined })
      expect(() => aliceStore.merge(bobStore.getGraph())).toThrow()

      aliceStore.dispatch({ type: 'INCREMENT', payload: 5 })
      expect(reload(aliceStore.save()).getState().value).toBe(5)
    })
  })
})
