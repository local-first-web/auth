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

## team lockbox map

created by `collectLockboxes`

```ts
lockboxes: Lockbox[]
```

## user keyset map

returned by `getKeys`

```ts
keys = {
  TEAM: {
    TEAM: KeysetWithSecrets[],
  },
  ROLE: {
    admin: KeysetWithSecrets[],
    managers: KeysetWithSecrets[],
  },
}
```
