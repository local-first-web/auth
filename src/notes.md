### User

The local user and their private & public keys. The name provided can be an existing username, an email address, or an ID. It needs to uniquely identify the user within this team.

```ts
import { user } from 'taco'
const alice = user.create('alice')

// OR

const alice = user.load('alice')

// {
//   name: 'alice',
//   keys: {
//     seed: 'qI7WZR+BGTAJD30JJRqRCVOLWL7iGxIHlbBmq80bjLg=',
//     signature: {
//       publicKey: 'xvIoa0SjV7C+tIwVLaGAXSWLH/H8KwC3BVMsQO68Er4=',
//       secretKey: 'Fv/HjgaQxrYTP+a5r0G20QppX2OD7tVFuXs...L60jBUtoYBdJYsf8fwrALcFUyxA7rwSvg==',
//     },
//     asymmetric: {
//       publicKey: 'Yxb5B79mNvtDg9kjvDHIlFK4pu8XvXT0to9TtILijig=',
//       secretKey: 'P2rSWEUUInw/ZwkbVwV8/W6+2n2JCNeiV2S5rtyRa5I=',
//     },
//     symmetric: { key: 'DDJy5aFAzGuSkwcA2PuPMqcO5Nc1VJDincnayGiaLDQ=' },
//   }
// }
```

### Context

The context object is passed in when instantiating a team to identify the runtime environment; it identifies the current local user, the device we're running on, and client application.

#### Device

The name of the device needs to be unique among this user's devices.

```ts
const device = {
  name: 'Windows Laptop 2019-12-11',
  type: DeviceType.laptop,
}
```

#### Client

Optionally, you can identify the client application.

```ts
const client = {
  name: 'AmazingTeamApp',
  version: '1.2.3',
}
```

### Team

```ts
import { Team } from 'taco'

// create new
const context = { user, device, client }
const team = new Team({name: 'Spies Я Us', context})

// OR load from storage
const chain = localStorage.getItem('myTeamChain')
const team = new Team({chain, context})

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

### Crypto tools

Team also comes with crypto tools that use keys from the chain.

```ts
const { encrypt, decrypt, sign, verify } = Team.crypto

// asymmetric encryption
encrypt({ message, sender, recipient })

// signatures
const { sign, verify } = signatures
```
