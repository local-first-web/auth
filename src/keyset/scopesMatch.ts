import assert from 'assert'
import { HasScope } from '/keyset'
import { getScope } from '/keyset/getScope'

export const scopesMatch = (a: HasScope, b: HasScope) => {
  const scopeA = getScope(a)
  const scopeB = getScope(b)
  return scopeA.type === scopeB.type && scopeA.name === scopeB.name
}

export const assertScopesMatch = (a: HasScope, b: HasScope) => {
  assert(
    scopesMatch(a, b),
    `The scope of the new keys must match those of the old lockbox. 
     New scope: ${JSON.stringify(getScope(a))} 
     Old scope: ${JSON.stringify(getScope(b))}`
  )
}
