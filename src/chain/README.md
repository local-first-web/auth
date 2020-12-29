## ✍🔗 Signature chain

A signature chain is an acyclic directed graph of links. Each link

- is **cryptographically signed** by the author; and
- includes a **hash of the parent link**.

This means that the chain is **append-only**: Existing nodes can’t be modified, reordered, or removed without causing the hash and signature checks to fail.

![sigchain.1](https://raw.githubusercontent.com/HerbCaudill/pics/master/sigchain.1.png)

A signature chain is just data and can be stored as JSON. It consists of a hash table of the links themselves, plus a pointer to the **root** (the “founding” link added when the chain was created) and the **head** (the most recent link we know about).

### Determining group membership

By itself, the `chain` module doesn't know anything about teams or access rules. It just creates chains, appends to them, and checks them for internal validity.

The `team` module contributes the semantics of different types of links and their corresponding payloads: For example, a link with the `ADD_MEMBER` type has a payload containing information about the member to be added, as well as a list of roles to add them to.

A team’s latest membership state is calculated by running a chain’s collection of links through a reducer, much the same way Redux uses a reducer to calculate state as the accumulated effect of a sequence of actions. The reducer will throw an error if there are any violations of group rules—for example, a non-admin inviting or removing members, or a member doing anything after they’ve been removed.

### Merging and conflict resolution

This system is designed to allow **decentralized, intermittently connected peers** to collaborate **without a central server**; so we take for granted that any two members might make membership changes while disconnected from each other.

If Alice adds new links to the signature chain while disconnected from Bob, there’s no problem: When they sync up, Bob will realize that he’s behind and he’ll get the latest links in the chain.

Now suppose Alice and Bob _both_ add new links to the signature while they’re disconnected from each other. When they sync up, they each add a special **merge link**, pointing to their two divergent heads. This merge link becomes the new head for both of them.

![image](https://user-images.githubusercontent.com/2136620/98110368-43240700-1e9f-11eb-9ea9-ecd1253e9ffe.png)

In many cases, we can accept all the concurrent changes in some arbitrary order, and it all works out. There are a few tricky scenarios, though, where Alice and Bob’s concurrent changes may be at odds with each other. For example, what do you do if…

1. Alice and Bob concurrently remove each other?
2. Alice removes Bob, and Bob concurrently adds a new member Charlie?
3. Alice removes Bob, while concurrently Charlie removes Bob and then adds him back?

(The questions are the same whether you read “remove” as “remove from the group” or “remove from the admin role”.)

In most of these cases, we adopt a “strong-remove” policy for group and role membership: We **err on the side of removal**, reasoning that we can always add someone back if they shouldn’t have been removed, but you can’t reverse the leak of information that might take place if someone who you thought was removed was in fact still around. So in case (2), we don’t allow Bob’s addition of Debbie; and in case (3), Bob stays removed. In case (1), we use seniority as a tiebreaker: Whoever has been on the team longest wins. (This the only deviation from a strict "strong-remove" policy, which would resolve this case by removing them both.)<a id='link-note-1' href='#note-1'>[1]</a>

We implement this policy using a custom **resolver**. A resolver is a function that takes two concurrent sequences of links and turns them into a single sequence. This is done deterministically, so that every member processing the same signature chain independently converges on the same group membership state.

A resolver decides how to order the links in the two sequences, and which links to omit. This diagram shows a few different ways that one graph might be sequenced, depending on the resolver’s rules:

![sigchain.3](https://raw.githubusercontent.com/HerbCaudill/pics/master/sigchain.3.png)

Here’s how we resolve scenario (2) above: Bob’s addition of Charlie is omitted, because he was concurrently being removed by Alice.

![sigchain.5](https://raw.githubusercontent.com/HerbCaudill/pics/master/sigchain.5.png)

So we end up with this ordered sequence of links:

![sigchain.6](https://raw.githubusercontent.com/HerbCaudill/pics/master/sigchain.6.png)

---

### Link structure

A link is an object that looks like this:

```ts
{
  hash: Base64
  body: {
    type: string
    payload: any
    context: Context
    timestamp: UnixTimestamp
    prev: Base64
  }
  signed: {
    signature: Base64
    userName: string
    key: Base64
  }
}
```

#### User-provided fields

- `type` is a label for the type of action that this link represents - for example, `ADD_MEMBER` or `REMOVE`. (This is conceptually similar to a Redux action type.) The `team` module defines the valid types.

- `payload` is the content of the action - for example, it might contain the name and public keys of a member being added. (Likewise, this is analogous to the payload of a Redux action.)

- `context` contains information about the environment in which the link was created - who authored it, on what device, using what software. For example:

  ```js
  context: {
    user: 'alice',
    device: {
      id: 'dell-123',
      name: 'windows laptop',
      type: 'laptop'
    },
    client: {
      name: 'test',
      version: '0'
    }
  }
  ```

#### Generated fields

- `hash` is a hash of the link’s own `body`; it also serves as the ID for referring to the link.
- `prev` contains the hash of the previous link (or `null` in the case of the root link).
- `timestamp` contains the Unix timestamp of the creation of the link.

### Helper functions

#### `create(payload, context)`

Returns a signature chain containing a single root element.

```js
const payload = { team: 'Spies Я Us' }
const chain = create(payload, context)
```

#### `append(chain, link, context)`

Takes a chain, a partial link body (containing just a `type` and a `payload`), and a context; and returns a new chain with the link filled out, signed, and populated with the hash of the preceding link.

```js
const newChain = append(
  chain,
  { type: 'ADD_USER', payload: { name: 'bob', keys: {...} } },
  context
)
```

#### `validate(chain)`

Runs a chain through a set of validators that ensure that each link

- matches its **signature**,
- has a **hash** matching the previous link, and
- has an **index** that is consecutive to the previous link.

Returns an object with two properties:

- **`isValid`** is true or false
- if `isValid` is false, **`error`** is an object containing
  - `message` describing the first error found, an
  - `index` the index of the link containing the error
  - `details` any additional specifics about the error

For example, suppose Eve tampers with the root link's payload to change the name of the team from "Spies Я Us" to "Dorks Я Us". Validation will show that the signature of the link no longer matches the body of the link:

```js
const result = validate(chain)

// {
//   isValid: false
//   error: {
//     message: 'Signature is not valid',
//     index: 0,
//     details: {
//       payload: {
//         type: 'ROOT',
//         payload: { team: 'Dorks Я Us' },
//         context: { ... },
//         timestamp: 1588506524404,
//         prev: null,
//         index: 0
//       },
//       signature: '0eUheuxOU1F1puoTsQzGzcVCbC...ah3vBBKbQzkGFJ7V9+9DFAg==',
//       publicKey: '6xPEKryp82mUOl7OvT2NGdBm1iGWE3KsOwml20nAht8='
//     }
//   }
// }
```

---

<a id='note-1' href='#link-note-1'>[1]</a> The notion of “strong-remove” group membership scheme, and this discussion of potential conflicts, is taken from: Matthew Weidner, Martin Kleppmann, Daniel Hugenroth, and Alastair R. Beresford. Key Agreement for Decentralized Secure Group Messaging. _Cryptology ePrint Archive, Report 2020/1281_, 2020. https://eprint.iacr.org/2020/1281
