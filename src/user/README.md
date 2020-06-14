### 👩🏾‍🦱 User

The local user and their private & public keys. The name provided can be an existing username, an email address, or an ID. It needs to uniquely identify the user within this team.

```js
import { user } from 'taco'
const alice = user.create('alice')

// OR

const alice = user.load('alice')

// {
//   name: 'alice',
//   keys: {
//     secretKey: 'DDJy5aFAzGuSkwcA2PuPMqcO5Nc1VJDincnayGiaLDQ=',
//     encryption: {
//       publicKey: 'Yxb5B79mNvtDg9kjvDHIlFK4pu8XvXT0to9TtILijig=',
//       secretKey: 'P2rSWEUUInw/ZwkbVwV8/W6+2n2JCNeiV2S5rtyRa5I=',
//     },
//     signature: {
//       publicKey: 'xvIoa0SjV7C+tIwVLaGAXSWLH/H8KwC3BVMsQO68Er4=',
//       secretKey: 'Fv/HjgaQxrYTP+a5r0G20QppX2OD7tVFuXs...L60jBUtoYBdJYsf8fwrALcFUyxA7rwSvg==',
//     },
//   }
// }
```
