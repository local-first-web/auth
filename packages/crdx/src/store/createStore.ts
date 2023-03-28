import { Store } from './Store'
import { StoreOptions } from './StoreOptions'
import { Action } from '/graph'

export const createStore = <S, A extends Action, C>(options: StoreOptions<S, A, C>) => {
  return new Store(options)
}
