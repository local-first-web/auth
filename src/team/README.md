## 👩🏾👨‍🦲👳‍♂️👵 Team


The `Team` class wraps the signature chain and encapsulates the team's members, devices, and roles. 


## Public API

### Team

#### `new Team({name context})`

Alice can create a new team by passing the local user's context, along with a name for the team.

```js
// 👩🏾 Alice
import { Team, localUser } from 'taco'

const alice = localUser.create('alice')
const context = { user: alice, device: { ... } }
                 
const team = new Team({ name: 'Spies Я Us', context })
```

As the founding member of the team, Alice is automatically an admin. 

#### `team.save()`

The team's state is contained in its signature chain. You can persist the chain however you want: browser storage, a database, etc. This example uses `LocalStorage`:

```js
// get chain for storage
const chain = team.save()
// save in local storage
localStorage.setItem('myTeamChain', chain)
```

#### `new Team({source, context})`

To retrieve a team from storage, instantiate a new team with the stored chain and the local user's context.

```js
const chain = localStorage.getItem('myTeamChain')
const team = new Team({ source: chain, context })
```

### Invitations

The core problem this library was created to solve is how to invite people securely to a team, without relying on a central server. This is one of the trickier practical problems in public-key cryptography: How does Alice obtain Bob's public keys in the first place, without worrying that someone else is passing off their own credentials as Bob's? 

One solution is to trust one or more certification authorities. For example, this is how SSL/TLS solves the problem. But we don't want to rely on any central sources of truth. 

Another solution is **t**rust **o**n **f**irst **u**se (TOFU): When Alice invites Bob, she accepts the first Bob she's introduced to. This is what many services offering end-to-end encryption do, including WhatsApp, Signal, and Telegram. But as [this Keybase blog post](https://keybase.io/blog/chat-apps-softer-than-tofu) points out, TOFU should really be called TADA (**t**rust **a**fter each **d**evice **a**ddition), because every time a user deauthorizes a device or authorizes a new one, you have to trust the server; and in our current multi-device world this happens more and more often.

Our protocol, TACO (**t**rust **a**fter **c**onfirmation **o**f invitation), is loosely based on Keybase's [Seitan Token v2 exchange protocol](http://keybase.io/docs/teams/seitan_v2). At a high level, this is how it works:

- **Secret key**  
  Alice randomly generates a single-use secret and sends it to Bob via a side channel
- **Public invitation**  
  Alice uses the secret to derive a single-use signing keypair and posts the public key
- **Proof of invitation**  
  Bob derives the same signing keypair and uses it to sign something
- **Admittance**  
  Charlie verifies that Bob's proof was signed with the invitation's public signing key, and lets Bob in

This protocol relies on a trusted side channel only once, to transmit the secret invitation key. 

#### `team.invite(member, [roles])`

```js
// 👩🏾 Alice
const { secretKey, id } = team.invite('bob')
```

Alice can optionally include an array of roles that the member should be added to when they accept.

```js
const { secretKey, id } = team.invite('bob', ['managers'])
```

The invitation's `secretKey` is a single-use 16-character string like `aj7x d2jr 9c8f zrbs`. To make it easier
to retype if needed, it is in base-30 format, which omits easily confused characters. This is a
secret that only Alice and Bob will ever know. It might be typed directly into your application, or
appended to a URL that Bob can click to accept:

> Alice has invited you to team XYZ. To accept, click: http://xyz.org/accept/aj7x+d2jr+9c8f+zrbs

Alice will send the invitation to Bob via a side channel she already trusts (phone call, email, SMS, WhatsApp, Telegram, etc).

#### `acceptInvitation(secretKey)`

Bob uses the secret invitation key to generate proof that he was invited, without divulging the secret key.

```js
// 👴🏻 Bob
import { acceptInvitation } from 'taco'
const proofOfInvitation = acceptInvitation('aj7x d2jr 9c8f zrbs')
```

#### `team.admit(proof)`

When Bob shows up to join the team, anyone can validate his proof of invitation to admit him to the team - it doesn't have to be an admin.

```js
// 👳‍♂️ Charlie
team.admit(proofOfInvitation)
const success = team.has('bob') // TRUE
```

#### `team.revokeInvitation(id)`

Alice needs the invitation `id` in case she has to revoke an invitation.

```js
// 👩🏾 Alice
team.revokeInvitation(id)
```

If Bob has not accepted the invitation, he will not be admitted. If he has already accepted, this will throw an error. 

### Members

A `Member` needs to have a `userName` and a `keys` property containing the member's public keys. 

```js
const bob = {
  userName: 'bob',
  keys: { 
    encryption: `ptpo61ySZBKW63EjetFpTMpwwPqTjfdLRBkWux0xTtdA7lE3=`,
    signature: `P80ESmjlXydk5g6GbItyzVz3L903mEJUChjF1Nv2rTsznV5e=`
  }, 
}
```

A member's `userName` needs to identify a person uniquely within your team. You could use existing user names, staff IDs, or email addresses.

#### 	`team.add(member, roles)`

To add a member directly, they need to already have NaCl-compatible keypairs for encryption and signatures, and they need to give you the corresponding public keys. 

In practice, you're more likely to use the invitation process to add members, since it takes care of generating and exchanging keys. 

```js
team.add(bob) 
```

When adding a member, you can optionally pass an array of role names to add them to. 

```js
team.add(bob, ['managers'])
```

#### `team.remove(userName)`

To remove a member from a team, pass their user name.

```js
team.remove('eve')
```

#### `team.members()`

When no user name is passed, `members()` returns a full list of team members.

```js
const members = team.members()
```

#### `team.members(userName)`

Provide a user name to retrieve a specific member. An error will be thrown if the member is not on the team. 

```js
const bob = team.members('bob')
```

#### `team.has(userName)`

Check whether a team has a member with the given user name.

```js
const bobIsMember = team.has('bob') // TRUE
```

### Roles

A `Role` has a `roleName` and an optional `permissions` object. 

```js
const managers = { roleName: 'manager', permissions: { ... }}
```

The role named `admin` is built into every team and can't be altered. The admin role is required to invite or remove members and to manage roles. 

A role's `permissions` payload is for your application's use; Taco doesn't care what it contains. 

#### `team.addRole(role)`

```js
team.addRole({ roleName: 'reader' })
team.addRole(managers)
```

#### `team.removeRole(roleName)`

Remove a role from the team.

```js
// remove role
team.roles.remove('manager')
```

#### `team.roles()`

List all of the roles on a team.

```js
team.roles()
```

#### `team.addMemberRole(userName, roleName)`

Assign a role to a member.

```js
team.addMemberRole('charlie', 'manager')
```

#### `team.removeMemberRole(userName, roleName)`

Remove a role from a member.

```js
team.removeMemberRole('bob', 'manager')
```

#### `team.memberIsAdmin(userName)`

Check whether a team member is an admin.

```js
const bobIsAdmin = team.memberIsAdmin('bob')
```

#### `team.admins()`

List the team's admin members.

```js
const admins = team.admins()
```

#### `team.memberHasRole(userName, roleName)`

Check whether a team member is in a specific role.

```js
const bobIsManager = team.memberHasRole('bob', 'manager')
```

### Crypto tools

The `Team` class provides convenience methods for public-key encryption and signatures within the team.

```js
// Alice encrypts the message asymmetrically for the whole team
const encryptedMessage = team.encrypt('One if by night, two if by day')

// Bob decrypts the message
const decryptedMessage = team.decrypt(encryptedMessage)
```

You can also encrypt a message just for a specific role:

```js
// Alice encrypts the message for admins
const encryptedMessage = team.encrypt('Two if by night, one if by day', ADMIN)
```

Team members can sign messages, and validate messages signed by other members.

```js
// Alice signs a message
const signedMessage = team.sign('Flee at once, we are discovered!')

// Bob validates the signature
const isValid = team.verify(signedMessage) // true
```

## Internals

Each link has a `type` and a `payload`, just like a Redux action. So we can derive a `teamState` from `teamChain`, by applying a Redux-style reducer to the array of links.

```js
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



