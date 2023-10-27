import { type KeyScope } from '@localfirst/crdx'

export const getScope = <T extends KeyScope>(x: T): KeyScope => ({
  type: x.type,
  name: x.name,
})
