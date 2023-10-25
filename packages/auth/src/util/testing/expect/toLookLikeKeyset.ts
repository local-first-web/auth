// ignore coverage
import { expect } from 'vitest'

expect.extend({
  toLookLikeKeyset(maybeKeyset: any) {
    const looksLikeKeyset =
      maybeKeyset.hasOwnProperty('encryption') &&
      maybeKeyset.hasOwnProperty('signature')
    if (looksLikeKeyset) {
      return {
        message: () => 'expected not to look like a keyset',
        pass: true,
      }
    }

    return {
      message: () => 'expected to look like a keyset',
      pass: false,
    }
  },
})
