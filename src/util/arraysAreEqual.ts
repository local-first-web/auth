export const arraysAreEqual = (a: string[], b: string[]) => {
  const normalize = (arr: string[]) => arr.sort().join(',')
  return normalize(a) === normalize(b)
}
