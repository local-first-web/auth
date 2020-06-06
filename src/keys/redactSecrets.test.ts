import { newKeys } from '/keys/generateKeys'
import { redactKeys } from '/keys/redactSecrets'
import { KeyScope, KeysWithSecrets } from '/keys/types'

describe('redactSecrets', () => {
  it('should redact secrets from a random keyset', () => {
    const secretKeyset = newKeys({ scope: KeyScope.MEMBER, name: 'foo' })

    const publicKeyset = redactKeys(secretKeyset)

    expect(publicKeyset).toHaveProperty('encryption')
    expect(publicKeyset).toHaveProperty('signature')

    expect(publicKeyset.signature).not.toHaveProperty('secretKey')
    expect(publicKeyset.encryption).not.toHaveProperty('secretKey')
  })

  it('should redact secrets from a known keyset', () => {
    const secretKeyset: KeysWithSecrets = {
      scope: KeyScope.EPHEMERAL,
      name: KeyScope.EPHEMERAL,
      generation: 0,
      signature: {
        publicKey: 'xvIoa0SjV7C+tIwVLaGAXSWLH/H8KwC3BVMsQO68Er4=',
        secretKey: 'Fv/HjgaQxrYTP+a5r0G20QppX2OD7tVFuXs...L60jBUtoYBdJYsf8fwrALcFUyxA7rwSvg==',
      },
      encryption: {
        publicKey: 'Yxb5B79mNvtDg9kjvDHIlFK4pu8XvXT0to9TtILijig=',
        secretKey: 'P2rSWEUUInw/ZwkbVwV8/W6+2n2JCNeiV2S5rtyRa5I=',
      },
    }

    const publicKeyset = redactKeys(secretKeyset)

    expect(publicKeyset).toEqual({
      scope: KeyScope.EPHEMERAL,
      name: KeyScope.EPHEMERAL,
      encryption: 'Yxb5B79mNvtDg9kjvDHIlFK4pu8XvXT0to9TtILijig=',
      signature: 'xvIoa0SjV7C+tIwVLaGAXSWLH/H8KwC3BVMsQO68Er4=',
      generation: 0,
    })
  })
})
