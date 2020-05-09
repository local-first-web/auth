import { redactKeys } from './redactSecrets'
import { randomKey } from './randomKey'
import { deriveKeys } from './deriveKeys'

describe('redactSecrets', () => {
  it('should redact secrets from a random keyset', () => {
    const secretKey = randomKey()
    const secretKeyset = deriveKeys(secretKey)

    const publicKeyset = redactKeys(secretKeyset)
    expect(publicKeyset).toHaveProperty('encryption')
    expect(publicKeyset).toHaveProperty('signature')
    expect(publicKeyset.signature).not.toHaveProperty('secretKey')
    expect(publicKeyset).not.toHaveProperty('asymmetric')
    expect(publicKeyset).not.toHaveProperty('symmetric')
  })

  it('should redact secrets from a known keyset', () => {
    const secretKeyset = {
      seed: 'xvIoa0SjV7C+tIwVLaGAXSWLH/H8KwC3BVMsQO68Er4=',
      signature: {
        publicKey: 'xvIoa0SjV7C+tIwVLaGAXSWLH/H8KwC3BVMsQO68Er4=',
        secretKey:
          'Fv/HjgaQxrYTP+a5r0G20QppX2OD7tVFuXs...L60jBUtoYBdJYsf8fwrALcFUyxA7rwSvg==',
      },
      asymmetric: {
        publicKey: 'Yxb5B79mNvtDg9kjvDHIlFK4pu8XvXT0to9TtILijig=',
        secretKey: 'P2rSWEUUInw/ZwkbVwV8/W6+2n2JCNeiV2S5rtyRa5I=',
      },
      symmetric: { key: 'DDJy5aFAzGuSkwcA2PuPMqcO5Nc1VJDincnayGiaLDQ=' },
      generation: 0,
    }

    const publicKeyset = redactKeys(secretKeyset)

    expect(publicKeyset).toEqual({
      encryption: 'Yxb5B79mNvtDg9kjvDHIlFK4pu8XvXT0to9TtILijig=',
      signature: 'xvIoa0SjV7C+tIwVLaGAXSWLH/H8KwC3BVMsQO68Er4=',
      generation: 0,
    })
  })
})
