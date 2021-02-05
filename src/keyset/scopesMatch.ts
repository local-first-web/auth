import assert from 'assert'
import { KeyScope, getScope } from '/keyset'

export const scopesMatch = (a: KeyScope, b: KeyScope) => {
  const scopeA = getScope(a)
  const scopeB = getScope(b)
  return scopeA.type === scopeB.type && scopeA.name === scopeB.name
}

export const assertScopesMatch = (a: KeyScope, b: KeyScope) => {
  assert(
    scopesMatch(a, b),
    `The scope of the new keys must match those of the old lockbox. 
     New scope: ${JSON.stringify(getScope(a))} 
     Old scope: ${JSON.stringify(getScope(b))}`
  )
}
