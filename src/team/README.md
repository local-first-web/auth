## 👵👨‍🦲👳‍♂️👩🏾 Team

```ts
import { Team } from 'taco'

// create new
const context = { user, device, client }
const team = new Team({ name: 'Spies Я Us', context })

// OR load from storage
const chain = localStorage.getItem('myTeamChain')
const team = new Team({ chain, context })

// get chain for storage
const chain = team.save()
```

### Members

```ts
// invite member
const invitationKey = team.invite('bob')

// add member
const bob = team.add(bob, ['managers']) 
const bob = team.add(charlie) 

// remove member
team.remove('eve')

// list members
const members = team.members()

// look up member
const bob = team.members('bob')


```

### Roles

If a role has `admin` permissions, it can write to the team signature chain. That is the only permissions setting we understand; anything beyond that is managed by your application.

```ts
// create role
const readers = team.roles.add('reader', { permissions: { ... }})
const managers = team.roles.add('manager', { permissions: { admin: true }})

// remove role
team.roles.remove('manager')

// list roles
team.roles()

// add member to role
team.addMemberRole('charlie', 'manager')

// remove member from role
team.removeMemberRole('bob', 'manager')

// check admin status
const bobIsAdmin = team.memberIsAdmin('bob')

// list admins
const admins = team.admins()

// check role membership
const bobIsManager = team.memberHasRole('bob', 'manager')
```

### Internals of membership tools

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

### Crypto tools

Team also comes with crypto tools that use keys from the chain.

```ts
const { encrypt, decrypt, sign, verify } = Team.crypto

// asymmetric encryption
encrypt({ message, sender, recipient })

// signatures
const { sign, verify } = signatures
```
