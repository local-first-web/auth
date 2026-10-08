// ignore file coverage
export const arraysAreEqual = (
  a: Array<string | undefined> | undefined,
  b: Array<string | undefined> | undefined
) => {
  if (!a || !b) return false

  const normalize = (array: Array<string | undefined>) =>
    [...array].sort((a, b) => String(a).localeCompare(String(b))).join(',')
  return normalize(a) === normalize(b)
}
