import nacl from 'tweetnacl'
import { base64 } from '/lib'

export const randomKey = (size: number = 32) => base64.encode(nacl.randomBytes(size))
