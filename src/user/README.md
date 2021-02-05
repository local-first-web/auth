## 👩🏾‍🦱 User

The local user and their private & public keys, including their device and device keys.

#### `user.create(userName, device)

When you first create a user, you'll need to obtain a username and details about the user's device.
This information is securely saved on the device.

The user name provided can be an existing username, an email address, or an ID. It needs to uniquely
identify the user within this team.

The name of the device needs to be unique among this user's devices.

```js
import { user } from 'taco'

const alicesLaptop = {
  userName: 'alice',
  deviceName: `Alice's MacBook`,
}

const currentUser = user.create('alice', alicesLaptop)
```

#### `user.load()`

For subsequent sessions, you can load the user information directly.

```js
const currentUser = user.load()
```
