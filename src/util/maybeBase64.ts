import * as base64 from '@stablelib/base64'

import { Key } from 'types'

export const maybeBase64 = (x: Key) =>
  typeof x === 'string' ? base64.decode(x) : x
