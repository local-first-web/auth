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

Each link has a `type` and a `payload`, just like a Redux action. So we can derive a `teamState` from `teamChain`, by applying a Redux-style reducer to the array of links. (See [reducer.ts](reducer.ts).)

```ts
const reducer = (prevState, link) => {
  const { type, payload, context } = link.body
  switch (type) {
    case 'ROOT': {
      const rootMember = { ...context.user, roles: [ADMIN] }
      const newState = {
        ...prevState,
        teamName: payload.teamName,
        members: [rootMember],
      }
      return newState
    }

    case 'ADD_MEMBER': {
      // ...
      return newState
    }
    
    // ...
  }
  
  return prevState
}
```

Note that the reducer is 

### Crypto tools

The `TeamCrypto` class provides tools for public-key encryption and signatures using the keys recorded in the team's signature chain. 

```ts
const { encrypt, decrypt, sign, verify } = new TeamCrypto(team)

// alice encrypts the message asymmetrically for bob
const encryptedMessage = encrypt({ 
    message: 'One if by night, two if by day', 
    recipient: 'bob' 
})

// bob decrypts the message
const decryptedMessage = decrypt({ 
    message: encryptedMessage, 
    sender: 'alice' 
})

// alice signs the message
const signedMessage = sign('Flee at once, we are discovered!')

// bob validates the signature
const isValid = verify(signedMessage) // true

```
