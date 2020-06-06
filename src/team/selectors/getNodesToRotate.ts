import { KeyNode } from '/keys'
import { TeamState } from '/team/types'

export const getNodesToRotate = (state: TeamState, rootNode: KeyNode) => {
  return [rootNode, ...getVisibleNodes(state, rootNode)]
}

const getVisibleNodes = (state: TeamState, { scope, name }: KeyNode): KeyNode[] => {
  const nodes = state.lockboxes
    .filter(({ recipient }) => recipient.scope === scope && recipient.name === name)
    .map(({ contents: { scope, name } }) => ({ scope, name } as KeyNode))

  const derivedNodes = nodes.flatMap(node => getVisibleNodes(state, node))
  return [...nodes, ...derivedNodes]
}
