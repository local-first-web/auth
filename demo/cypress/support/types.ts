export type CommandKey = keyof Cypress.Chainable<any>
export type CommandFn = (...args: any[]) => Cypress.Chainable
