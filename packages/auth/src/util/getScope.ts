import { type KeyScope } from '@localfirst/crdx'

export const getScope = (x: KeyScope): KeyScope => ({
  type: x.type,
  name: x.name,
})
