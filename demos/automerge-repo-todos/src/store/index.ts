import { configureStore } from "@reduxjs/toolkit"
import type { LocalState } from "../types"
import { initialState } from "./initialState"
import { reducer } from "./reducer"

const KEY = "localState"

// Load the state from local storage
const serializedState = window.localStorage.getItem(KEY)
const preloadedState =
  serializedState ? (JSON.parse(serializedState) as LocalState) : initialState

export const store = configureStore<LocalState>({ reducer, preloadedState })

// Save the state to local storage when it changes
store.subscribe(() => {
  const serializedState = JSON.stringify(store.getState())
  localStorage.setItem(KEY, serializedState)
})
