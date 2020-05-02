## 🔗 Signature chains

A signature chain is an ordered list of links. Each link

- is **cryptographically signed** by the author; and
- includes a **hash of the previous link**.

A signature chain is just data and can be stored as JSON. For example, here's a signature block containing two links:

```json
[
  {
    "body": {
      "type": 0,
      "payload": { "team": "Spies Я Us" },
      "user": "alice",
      "device": { "id": "PKN4tM7BtW8=", "name": "windows laptop", "type": 1 },
      "client": { "name": "test", "version": "0" },
      "timestamp": 1588421926221,
      "prev": null,
      "index": 0
    },
    "signed": {
      "name": "alice",
      "signature": "oTKyn8iTwrrAdH3zqoof34GwtTfzuni/qLkyu47uCuhPEkqNaGRKYBM/LWsW64RL3NJlnwMoIg+6NiYrhh2RBg==",
      "key": "/I7WZRWBGTAJD30JJRq+CVOLWL7iGxIHlbBmq80bjLg="
    }
  },
  {
    "body": {
      "type": "something",
      "payload": {},
      "user": "alice",
      "device": { "id": "PKN4tM7BtW8=", "name": "windows laptop", "type": 1 },
      "client": { "name": "test", "version": "0" },
      "timestamp": 1588421926268,
      "prev": "fog76617S9wsklpTz/pys7kud/ivZM11T+rtUplgMe/rGZicPZFEItOQcbKNNbgiB3JbGU2P1VKWERIVnyvcmQ==",
      "index": 1
    },
    "signed": {
      "name": "alice",
      "signature": "OM3MZ0lHL9Pdpex4WO9IDcii4IZa64Dok22XI9nk5ibbKKMWS0tlGipD8bUnxFiKXJ3ECpfRgpedBCmB9CW3Cw==",
      "key": "/I7WZRWBGTAJD30JJRq+CVOLWL7iGxIHlbBmq80bjLg="
    }
  }
]
```

### Link structure

Our signature chain is inspired by [Keybase's sigchain](https://book.keybase.io/docs/server#meet-your-sigchain-and-everyone-elses), but there are differences in the property names and structure.

```ts
export interface LinkBody {
  type: string
  payload: any
  context: Context
  timestamp: UnixTimestamp
  expires?: UnixTimestamp
  prev: Base64 | null
  index: number
}
```

#### User-provided fields

- `type` is a label for the type of action that this link represents - for example, `ADD_MEMBER` or `REVOKE`. (If you have used Redux before, it is conceptually similar to a Redux action type.) The `team` module defines the valid types.

- `payload` is the content of the action - for example, it might contain the name and public keys of a member being added.

- `context` contains information about the environment in which the link was created - who authored it, on what device, using what software. For example:
  ```ts
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

- `timestamp` contains the Unix timestamp of the creation of the link.

- `expires` (optional) contains an expiration date in the form of a Unix timestamp, after which point the block should be ignored.

- `prev` contains the hash of the previous link (or `null` in the case of the root link).

- `index` contains the zero-based sequential index of the link. The root link has index `0`, the next link has index `1`, and so on.

### Helper functions

#### create

Returns a signature chain containing a single root element.

The significance of the `payload` element is determined by the `team` module and by your application.

```ts
const payload = { team: 'Spies Я Us' }
const chain = create(payload, context)
```

#### append

Takes a chain, a partial link (containing just a `type` and a `payload`), and a context; and returns a new chain with the link filled out, signed, and populated with the hash of the preceding link.

```ts
const newChain = append(
  chain,
  { type: 'ADD_USER', payload: { name: 'bob', keys: {...} } },
  context
)
```

#### validate

Runs a chain through a set of validators that ensure that each link

- matches its signature
- has a hash matching the previous link
- has an index that is consecutive to the previous link
