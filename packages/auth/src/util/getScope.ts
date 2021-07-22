import { KeyScope } from 'crdx'

export const getScope = (x: KeyScope): KeyScope => ({
  type: x.type,
  name: x.name,
})
