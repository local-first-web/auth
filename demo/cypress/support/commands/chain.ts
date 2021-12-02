import { CommandFn } from '..'

export const chain: CommandFn = subject => {
  return cy.wrap(subject).find('.ChainDiagram svg g.nodes g.node')
}
