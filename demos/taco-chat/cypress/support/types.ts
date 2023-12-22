export type CommandKey = keyof Cypress.Chainable
export type CommandFn = (...args: any[]) => Cypress.Chainable
