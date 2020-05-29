## all keys

- team
- admin
- managers
- alice
- bob
- alice-laptop
- alice-phone
- bob-desktop
- bob-tablet

```ts

const getKey(ROLE, ADMIN)
```

## keyset

- scope (DEVICE/USER/ROLE/TEAM)
- name ('tablet', 'alice', 'admin', 'team')
- generation

## lockbox

```ts
type Credential

const lockbox = create({
  contents: Actor
  recipient: Actor
})
```

- encryptionKey
  - scope: EPHEMERAL
  - publicKey
- recipientKeys
  - scope
  - name
  - publicKey
  - generation
- contents
  - scope
  - name
  - publicKey
  - generation
- encryptedSecret

## encrypted content

- encryptedPayload
- encryptionKey
  - scope: SINGLE_USE
  - publicKey
- decryptionKey
  - scope
  - name
  - publicKey
  - generation

## todo

- separate device key & user key
  - when creating user
  - when creating team
