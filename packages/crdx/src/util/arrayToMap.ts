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
 * @param keyAccessor
 */
export const arrayToMap = <T extends Record<string, unknown>>(
  keyAccessor: string | KeyAccessor<T>
) => {
  return (result: Record<string, T>, current: T) => {
    const key = typeof keyAccessor === 'function' ? keyAccessor(current) : current[keyAccessor]
    return {
      ...result,
      [key as string]: current,
    } as Record<string, T>
  }
}

type KeyAccessor<T> = (obj: T) => string
