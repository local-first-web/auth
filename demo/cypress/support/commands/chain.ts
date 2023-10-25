import { type CommandFn } from '../types.js'

export const chain: CommandFn = subject => {
  return cy.wrap(subject).find('.ChainDiagram svg g.nodes g.node')
}
