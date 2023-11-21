/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable unused-imports/no-unused-imports */

// https://vitest.dev/guide/extending-matchers.html

import type { Assertion, AsymmetricMatchersContaining } from 'vitest'

interface CustomMatchers<R = unknown> {
  toBeValid(): R
  toLookLikeKeyset(): R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
