import { KeyScope } from '@/keyset/types'

export const getScope = (x: KeyScope): KeyScope => ({
  type: x.type,
  name: x.name,
})
