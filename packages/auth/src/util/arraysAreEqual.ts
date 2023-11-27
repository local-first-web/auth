// ignore file coverage
export const arraysAreEqual = (a: string[] | undefined, b: string[] | undefined) => {
  if (!a || !b) return false

  const normalize = (array: string[]) => array.sort().join(',')
  return normalize(a) === normalize(b)
}
