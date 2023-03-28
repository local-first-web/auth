import { Action, Link, Graph } from '/graph'

export interface InvalidResult {
  isValid: false
  error: ValidationError
}

export interface ValidResult {
  isValid: true
}

export class ValidationError extends Error {
  constructor(message: string, details?: any) {
    super()
    this.message = message
    this.details = details
  }

  public name: 'Hash Graph validation error'
  public details?: any
}

export type ValidationResult = ValidResult | InvalidResult

export type Validator = <A extends Action, C>(link: Link<A, C>, graph: Graph<A, C>) => ValidationResult

export type ValidatorSet = {
  [key: string]: Validator
}
