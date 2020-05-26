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
-

## lockbox

- encryptionKey
  - scope: SINGLE_USE
  - publicKey
- decryptionKey
  - scope
  - name
  - publicKey
  - generation
- encryptedKey
  - scope
  - name
  - publicKey
  - generation

## encrypted content

- encryptedContent
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
  -
