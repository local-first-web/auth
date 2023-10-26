import { type CommandFn } from '../types'

export const chain: CommandFn = subject => {
  return cy.wrap(subject).find('.ChainDiagram svg g.nodes g.node')
}
