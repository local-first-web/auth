import { ContextWithSecrets, DeviceType } from '../context'
import { deriveKeys, randomKey } from '../keys'
import { UserWithSecrets } from '../user'
import { Team } from './team'

describe('Team', () => {
  const alice: UserWithSecrets = {
    name: 'alice',
    keys: deriveKeys(randomKey()),
  }

  const context: ContextWithSecrets = {
    user: alice,
    device: {
      name: 'windows laptop',
      type: DeviceType.laptop,
    },
    client: {
      name: 'test',
      version: '0',
    },
  }

  beforeEach(() => {
    localStorage.clear()
  })

  test('should ', () => {})

  const setup = () => {
    const team = new Team({ name: 'Spies Я Us', context })
    return { team }
  }

  it('returns a new team', () => {
    const { team } = setup()
    expect(team.name).toBe('Spies Я Us')
  })

  // it('adds a root block to the signature chain', () => {
  //   const { team } = setup()
  //   expect(team.signatureChain).toHaveLength(1)
  //   const rootBlock = team.signatureChain[0].body
  //   expect(rootBlock.prev).toBeNull()
  //   expect(rootBlock.type).toEqual(LinkType.root)
  // })

  // it('root block has a valid signature', () => {
  //   const { team } = setup()
  //   const { body, signed } = team.signatureChain[0]
  //   const signedMessage = {
  //     content: body,
  //     signature: signed.signature,
  //     publicKey: signed.key,
  //   }
  //   const isValid = signatures.verify(signedMessage)
  //   expect(isValid).toBe(true)
})
