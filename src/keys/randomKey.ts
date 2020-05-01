import nacl from 'tweetnacl'
import { base64 } from '../lib'

export const randomKey = () => base64.encode(nacl.randomBytes(32))
