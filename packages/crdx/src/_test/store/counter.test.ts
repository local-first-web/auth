import { RootAction } from '/graph'
import { createStore } from '/store'
import { Reducer } from '/store/types'
import { TEST_GRAPH_KEYS as keys } from '/test/helpers/setup'
import { createUser } from '/user'

/*
This is intended to be the simplest possible proof of concept: An increment-only counter. There is
no custom resolver because there are no conflicts possible. 
*/

const alice = createUser('alice')
const bob = createUser('bob')

const setupCounter = () => {
  const aliceStore = createStore({ user: alice, reducer: counterReducer, keys })

  const saved = aliceStore.getGraph()
  const bobStore = createStore({ user: bob, graph: saved, reducer: counterReducer, keys })

  return { store: aliceStore, aliceStore, bobStore }
}

describe('counter', () => {
  describe('createStore', () => {
    test('initial state', () => {
      const { store } = setupCounter()
      expect(store.getState()).toEqual({ value: 0 })
    })

    test('increment', () => {
      const { store } = setupCounter()
      store.dispatch({ type: 'INCREMENT' })
      expect(store.getState().value).toEqual(1)
    })

    test('multiple increments', () => {
      const { store } = setupCounter()
      store.dispatch({ type: 'INCREMENT' })
      store.dispatch({ type: 'INCREMENT' })
      store.dispatch({ type: 'INCREMENT' })
      expect(store.getState().value).toEqual(3)
    })
  })

  describe('merge', () => {
    test('concurrent changes are merged', () => {
      const { aliceStore, bobStore } = setupCounter()

      // Bob and Alice make concurrent increments
      aliceStore.dispatch({ type: 'INCREMENT' })
      bobStore.dispatch({ type: 'INCREMENT' })

      // They each only have their own increments
      expect(aliceStore.getState().value).toEqual(1)
      expect(bobStore.getState().value).toEqual(1)

      // They sync up
      aliceStore.merge(bobStore.getGraph())
      bobStore.merge(aliceStore.getGraph())

      // They each have both increments
      expect(aliceStore.getState().value).toEqual(2)
      expect(bobStore.getState().value).toEqual(2)
    })
  })
})

// Counter

// action types

export type CounterAction = IncrementAction

export type IncrementAction =
  | RootAction
  | {
      type: 'INCREMENT'
      payload: number
    }

// state

export interface CounterState {
  value: number
}

// reducer

export const counterReducer: Reducer<CounterState, CounterAction> = (state, link) => {
  const action = link.body
  switch (action.type) {
    case 'ROOT': {
      return { value: 0 }
    }

    case 'INCREMENT': {
      const step = action.payload ?? 1
      return {
        ...state,
        value: state.value + step,
      }
    }

    default:
      // ignore coverage
      return state
  }
}
