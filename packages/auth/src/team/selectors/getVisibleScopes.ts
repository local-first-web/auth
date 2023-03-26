import { TeamState } from '@/team/types'
import { unique } from '@/util/unique'
import { KeyScope } from 'crdx'

export const getVisibleScopes = (state: TeamState, { type, name }: KeyScope): KeyScope[] => {
  // find the keys that the given key can see
  const scopes = state.lockboxes
    .filter(({ recipient }) => recipient.type === type && recipient.name === name)
    .map(({ contents: { type, name } }) => {
      return { type, name } as KeyScope
    })

  // recursively find all the keys that _those_ keys can see
  const derivedScopes = scopes.flatMap(scope => getVisibleScopes(state, scope))

  const allScopes = [...scopes, ...derivedScopes]
  return unique(allScopes, s => s.name + s.type)
}
