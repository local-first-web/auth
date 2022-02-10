## 💻 Context

The context object is passed in when instantiating a team to identify the runtime environment; it identifies the current local user, the device we're running on, and client application.

```js
const context = { user, device, client }
```

### Device

The name of the device needs to be unique among this user's devices.

```js
const device = {
  userName: 'bob',
  deviceName: 'iPhone 11',
}
```

### Client

Optionally, you can identify the client application.

```js
const client = {
  name: 'MyAmazingTeamApp',
  version: '1.2.3',
}
```
