import { clone as lodashClone } from 'lodash-es'

/**
 * Shallow clone. Wrapped rather than re-exported so that the published declaration carries its own
 * signature: re-exporting lodash's would make every consumer need `@types/lodash-es`.
 */
export const clone = <T>(value: T): T => lodashClone(value)
