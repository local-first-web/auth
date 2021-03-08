declare namespace jest {
  interface Matchers<R> {
    toBeValid(): CustomMatcherResult
    toLookLikeKeyset(): CustomMatcherResult
  }
}
