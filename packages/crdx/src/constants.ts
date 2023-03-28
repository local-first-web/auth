import { KeyScope } from './keyset'
import { ValidationResult } from './validator/types'

// avoiding enums
export const SIGNATURE = 'SIGNATURE'
export const ENCRYPTION = 'ENCRYPTION'
export const SYMMETRIC = 'SYMMETRIC'
export const LINK_HASH = 'LINK_HASH'

export const HashPurpose = { SIGNATURE, ENCRYPTION, SYMMETRIC, LINK_HASH } as const

export const ROOT = 'ROOT'
export const MERGE = 'MERGE'
export const VALID = { isValid: true } as ValidationResult

export const EPHEMERAL_SCOPE: KeyScope = { type: 'EPHEMERAL', name: 'EPHEMERAL' }
