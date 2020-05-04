describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  test('should ', () => {})
  // const setup = () => {
  //   const team = create({
  //     name: 'Spies Я Us', context: {
  //       'herb'
  //     }
  //   })
  //   return { team }
  // }
  // it('returns a new team', () => {
  //   const { team } = setup()
  //   expect(team.name).toBe('Spies Я Us')
  //   expect(team.rootUser.name).toBe('herb')
  // })

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
