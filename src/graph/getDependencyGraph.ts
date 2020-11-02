import { isMergeNode, SignatureGraph } from '/graph/types'
import { Hash } from '/util/types'

export const getDependencyGraph = (graph: SignatureGraph): Map<Hash, Hash[]> => {
  const dependencyGraph = new Map<Hash, Hash[]>()

  const addDependency = (parent: Hash, child: Hash) => {
    const dependencies = dependencyGraph.get(parent) ?? []
    dependencyGraph.set(parent, dependencies.concat(child))
  }

  for (const node of graph.nodes.values()) {
    if (isMergeNode(node)) {
      const parents = node.body
      for (const parent of parents) addDependency(parent, node.hash)
    } else {
      const parent = node.body.prev
      if (parent !== null) addDependency(parent, node.hash)
    }
  }
  return dependencyGraph
}
