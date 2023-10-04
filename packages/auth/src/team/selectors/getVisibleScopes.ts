import { KeyScope } from 'crdx'
import { TeamState } from '@/team/types.js'
import { unique } from '@/util/unique.js'

export const getVisibleScopes = (state: TeamState, { type, name }: KeyScope): KeyScope[] => {
  // find the keys that the given key can see
  const scopes = state.lockboxes
    .filter(({ recipient }) => recipient.type === type && recipient.name === name)
    .map(({ contents: { type, name } }) => {
      return { type, name } as KeyScope
    })

  // recursively find all the keys that _those_ keys can see
  const derivedScopes = scopes.flatMap(scope => getVisibleScopes(state, scope))

  return unique([...scopes, ...derivedScopes])
}
