import { NOLOG, wrap } from '../helpers'
import { type CommandFn } from '../types.js'

export const chain: CommandFn = subject => {
  return wrap(subject).find('.ChainDiagram svg g.nodes g.node', NOLOG)
}
