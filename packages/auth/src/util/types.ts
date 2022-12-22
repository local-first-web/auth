export type UnixTimestamp = number
export type Utf8 = string
export type Base58 = string
export type Hash = Base58
export type SemVer = string
export type Key = Utf8 | Uint8Array
export type Payload = Base58 | Uint8Array | object

export type Encrypted<T> = Base58

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<T>

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
