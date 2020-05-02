## Signature chains

A signature chain

### API

The `create` and `append` functions require a `context` object that describes the local user (including their secret keys), their device, and the client software. For example:

```ts
const context = {
  user: {
    name: 'alice',
    keys: deriveKeys('abc'),
  },
  device: {
    id: 'dell-123',
    name: 'windows laptop',
    type: DeviceType.laptop,
  },
  client: {
    name: 'test',
    version: '0',
  },
}
```

#### create

The `payload` of

```ts
const payload = { team: 'Spies Я Us' }
const chain = create(payload, context)
```

#### append

```ts
const newChain = append({ team: 'Spies Я Us' }, context)
```

#### validate
