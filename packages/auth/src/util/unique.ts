import { uniqBy } from 'lodash-es'

export const unique = uniqBy as <T>(array: T[], iteratee?: (item: T) => string) => T[]
