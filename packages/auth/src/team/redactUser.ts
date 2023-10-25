import {
  redactUser as _redactUser,
  type UserWithSecrets,
} from '@localfirst/crdx'
import { type Member } from './types.js'

export const redactUser = (user: UserWithSecrets): Member => ({
  ..._redactUser(user),
  roles: [],
})
