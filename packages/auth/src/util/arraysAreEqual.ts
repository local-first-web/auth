//ignore coverage
export const arraysAreEqual = (a: string[] | undefined, b: string[] | undefined) => {
  if (!a || !b) return false
  const normalize = (arr: string[]) => arr.sort().join(',')
  return normalize(a) === normalize(b)
}
