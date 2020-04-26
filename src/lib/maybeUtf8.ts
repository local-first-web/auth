import * as utf8 from '@stablelib/utf8'
import { Message } from 'types'

export const maybeUtf8 = (x: Message) =>
  typeof x === 'string' ? utf8.encode(x) : x
