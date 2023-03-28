/**
 * Reducer for converting an array of objects to a map containing the same objects, where the key is
 * taken from a field in each object (e.g. `id`, `hash`, etc.).
 *
 * ```ts
 * const arr = [
 *   {id: 1, ...},
 *   {id: 2, ...},
 *   {id: 3, ...}
 * ]
 * const mapped = arr.reduce(arrayToMap('id'), {})
 * // mapped = {
 * //   1: {id: 1, ...},
 * //   2: {id: 2, ...},
 * //   3: {id: 3, ...},
 * // }
 * ```
 * @param keyField
 */
export const arrayToMap = (keyField: string) => <T extends Record<string, any>>(
  result: Record<string, T>,
  current: T
): {} => ({
  ...result,
  [current[keyField]]: current,
})
