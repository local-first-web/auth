### Signature chain

We have `chain` in its own module. The chain itself is just data (an array of type `Link[]`).

```ts
import { create, load, validate, append } from './chain'

const actor = {
  name,
  encryptionKey,
  signatureKey,
  generation,
}
const chain = create({ payload, actor })
// OR
const chain = load(source)

const isValid = validate(chain) // true or false
const newChain = append({ link, actor, chain })
```

### Membership tools

Separately, we have functions in a `team` module for interpreting a chain as team state.

```ts
import { membershipTools } from './team'

const context = {
  localUser: { name, secretKey },
  device: { name, secretKey },
}

const { members, roles } = membershipTools(context)

// invite member
const { newTeamChain, invitationKey } = members.invite(teamChain, 'bob')

// remove member
const newTeamChain = members.remove(teamChain, 'eve')

// list members
const members = members.list()

// create role
const newTeamChain = roles.create(teamChain, 'managers')

// check admin status
const bobIsAdmin = roles.isAdmin(teamChain, 'bob')

// check role membership
const bobIsManager = roles.isInRole(teamChain, 'bob', 'managers')
```

#### Internals of membership tools

Each link has a `type` and a `payload`, just like a Redux action. So we can derive a `teamState` from `teamChain`, by applying a Redux-style reducer to the array of links.

```ts
const reducer = (prevState, link) => {
  const { type, payload } = link
  switch (type) {
    case 'ROOT':
      const { name, foundingMember } = payload
      const nextState = {
        name,
        foundingMember,
      }
      return nextState
      break

    case 'ADD_MEMBER':
      // ..
      return nextState
      break
  }
  return prevState
}

// the reducers don't validate the chain, we need to do that separately
const isValid = validate(chain)
if (!isValid) {
  // ?
} else {
  const teamState = teamChain.reduce(reducer, {})
  // ...
}
```

<!--
SigChain also comes with crypto tools that use keys from the chain.

```ts
const { encrypt, decrypt, sign, verify } = SigChain.crypto(chain)

// asymmetric encryption
encrypt({message, sender, recipient})

// signatures
const { sign, verify } = signatures
```
-->
