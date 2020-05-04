### Context

#### User

`User` always refers to the local user. If a user with the name given exists, their keys will be retrieved from secure storage; otherwise created

```ts
import { getUser } from 'taco'
const user = getUser('alice')
```

#### Device

#### Client

### Team

```ts
import { Team } from 'taco'

// create new
const context = { user, device, client }
const team = new Team({name: 'Spies Я Us', context})

// OR load from storage
const chain = localStorage.getItem('myTeamChain')
const team = new Team({chain})

// invite member
const invitationKey = team.invite('bob')

// add member
const bob = team.add('bob', ... ) // what is payload?
// OR
team.members.add('bob', ... )

// remove member
team.remove('eve')
// OR
team.members.remove('eve')

// list members
const members = team.members()

// get chain for storage
const chain = team.save()
```

#### Roles

If a role has `admin` permissions, it can write to the team signature chain. That is the only permissions setting we understand; anything beyond that is managed by the consuming application.

```ts
// create role
const readers = team.roles.add('reader', { permissions: { ... }})
const managers = team.roles.add('manager', { permissions: { admin: true }})

// remove role
team.roles.remove('manager')

// list roles
team.roles()
```

#### Members

```ts
const bob = team.members('bob')

// add to role
team.members('bob').addRole('manager')
// OR
team.roles('manager').addMember('bob')

// remove from role
team.members('bob').removeRole('manager')
// OR
team.roles('manager').removeMember('bob')

// check admin status
const bobIsAdmin = team.members('bob').hasPermission()

// check role membership
const bobIsManager = team.members('bob').hasRole('manager')
// OR
const bobIsManager = team.roles('manager').hasMember('bob')

// list admins
const admins = team.admins()
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
