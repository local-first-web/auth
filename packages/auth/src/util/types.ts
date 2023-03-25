export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<T>

// KEY TYPES

export const KeyType = {
  GRAPH: 'GRAPH',
  TEAM: 'TEAM',
  ROLE: 'ROLE',
  USER: 'USER',
  DEVICE: 'DEVICE',
  SERVER: 'SERVER',
  EPHEMERAL: 'EPHEMERAL',
} as const
export type KeyType = (typeof KeyType)[keyof typeof KeyType]

// VALIDATION

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

  public name: 'Signature chain validation error'
  public details?: any
}

export type ValidationResult = ValidResult | InvalidResult
