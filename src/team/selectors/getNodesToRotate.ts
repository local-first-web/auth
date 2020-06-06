import { KeyScope } from '/keys'
import { TeamState } from '/team/types'

export const getNodesToRotate = (state: TeamState, rootNode: KeyScope) => {
  return [rootNode, ...getVisibleNodes(state, rootNode)]
}

const getVisibleNodes = (state: TeamState, { type, name }: KeyScope): KeyScope[] => {
  const nodes = state.lockboxes
    .filter(({ recipient }) => recipient.type === type && recipient.name === name)
    .map(({ contents: { type, name } }) => ({ type, name } as KeyScope))

  const derivedNodes = nodes.flatMap(node => getVisibleNodes(state, node))
  return [...nodes, ...derivedNodes]
}
