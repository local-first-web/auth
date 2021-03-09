import { KeyScope } from '@/keyset'
import { TeamState } from '@/team/types'

export const scopesToRotate = (state: TeamState, compromisedScope: KeyScope) => {
  return [compromisedScope, ...getVisibleScopes(state, compromisedScope)]
}

export const getVisibleScopes = (state: TeamState, { type, name }: KeyScope): KeyScope[] => {
  const scopes = state.lockboxes
    .filter(({ recipient }) => recipient.type === type && recipient.name === name)
    .map(({ contents: { type, name } }) => ({ type, name } as KeyScope))

  const derivedScopes = scopes.flatMap(scope => getVisibleScopes(state, scope))
  return [...scopes, ...derivedScopes]
}
