import { makeMachine } from '@localfirst/crdx'
import { initialState } from './constants.js'
import { reducer } from './reducer.js'
import { membershipResolver as resolver } from './membershipResolver.js'

export const teamMachine = makeMachine({ initialState, reducer, resolver })
