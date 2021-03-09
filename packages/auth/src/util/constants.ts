import { ValidationResult } from '@/util/types'

export enum HashPurpose {
  SIGNATURE = 'SIGNATURE',
  ENCRYPTION = 'ENCRYPTION',
  SYMMETRIC = 'SYMMETRIC',
  LINK_TO_PREVIOUS = 'LINK_TO_PREVIOUS',
  INVITATION = 'INVITATION',
  DEVICE_ID = 'DEVICE_ID',
  SHARED_KEY = 'SHARED_KEY',
}

export const VALID = { isValid: true } as ValidationResult
