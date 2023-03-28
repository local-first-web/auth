declare namespace jest {
  interface Matchers<R> {
    toBeValid(expectedMessage?: string): CustomMatcherResult
    toLookLikeKeyset(): CustomMatcherResult
  }
}
