import * as users from '/user'
import { UserWithSecrets } from '/user'
import { assert } from '/util'
import { arrayToMap } from './arrayToMap'
import { KeysetWithSecrets } from '/keyset'
import { Base58 } from '@localfirst/crypto'

/**
Usage: 

```ts
const {alice, bob} = setup(['alice', 'bob'])
```
*/
export const setup = (...userNames: string[]) => {
  assert(userNames.length > 0)

  const testUsers: Record<string, UserWithSecrets> = userNames
    .map((userName: string) => {
      return users.createUser(userName)
    })
    .reduce(arrayToMap('userName'), {})

  const makeUserStuff = (userName: string): UserWithSecrets => {
    return testUsers[userName]
  }

  const testUserStuff: Record<string, UserWithSecrets> = userNames.map(makeUserStuff).reduce(arrayToMap('userName'), {})

  return testUserStuff
}

export const TEST_GRAPH_KEYS: KeysetWithSecrets = {
  type: 'GRAPH',
  name: 'GRAPH',
  generation: 0,
  signature: {
    publicKey: 'GQrmBanGPSFBvZ4AHAoduk1jp7tXxa5fuzmWQTfbCbRT' as Base58,
    secretKey: 'P7AgGTmMNedfpDixXF1rJgmVpyqAwCnGJRqyQzbm5wQbUnfoySAWMBzjxcm8USprqRNcW2ZoEEbzwPRX7EFuZkD' as Base58,
  },
  encryption: {
    publicKey: '7QviM4tWnhSwrrmrZnqEm3vFWrp3nvFwdcQShaFZ7nXj' as Base58,
    secretKey: 'HiFFKM6Eg1zkDHYkFcDLpEq7BM3k3FywHpj4zxQzVvHj' as Base58,
  },
  secretKey: 'GUg4dKHG1KWnysf4tsMtbBXvbuknj2q34qvjxYZzc5eP' as Base58,
}
