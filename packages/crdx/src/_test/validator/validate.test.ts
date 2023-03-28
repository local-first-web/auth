import { asymmetric } from '@localfirst/crypto'
import { buildGraph } from '/test/helpers/graph'
import { append, createGraph, getHead, getLink, getRoot } from '/graph'
import { hashEncryptedLink } from '/graph/hashLink'
import { setup, TEST_GRAPH_KEYS as keys } from '/test/helpers/setup'
import { validate } from '/validator/validate'
import '/test/helpers/expect/toBeValid'

import { jest } from '@jest/globals'
import { Hash } from '/util'
const { setSystemTime } = jest.useFakeTimers()

const { alice, eve } = setup('alice', 'eve')

describe('graphs', () => {
  describe('validation', () => {
    describe('valid graphs', () => {
      test(`new graph`, () => {
        const graph = createGraph({ user: alice, name: 'Spies Я Us', keys })
        expect(validate(graph)).toBeValid()
      })

      test(`new graph with one additional link`, () => {
        const graph = createGraph({ user: alice, name: 'Spies Я Us', keys })
        const newLink = { type: 'FOO', payload: { name: 'charlie' } }
        const newGraph = append({ graph, action: newLink, user: alice, keys })
        expect(validate(newGraph)).toBeValid()
      })
    })

    describe('invalid graphs', () => {
      const setupGraph = () => {
        const graph = buildGraph(`
                             ┌─ e ─ g ─┐
                   ┌─ c ─ d ─┤         ├─ o ─┐
            a ─ b ─┤         └─── f ───┤     ├─ n
                   ├──── h ──── i ─────┘     │ 
                   └───── j ─── k ── l ──────┘           
      `)
        expect(validate(graph)).toBeValid()
        return graph
      }

      test('The ROOT link cannot have any predecessors ', () => {
        const graph = setupGraph()
        const rootLink = getRoot(graph)

        rootLink.body.prev = graph.head
        expect(validate(graph)).not.toBeValid(`ROOT link cannot have any predecessors`)
      })

      test('The ROOT link has to be the link referenced by the graph `root` property', () => {
        const graph = setupGraph()
        graph.root = graph.head[0]
        expect(validate(graph)).not.toBeValid('ROOT link has to be the link referenced by the graph `root` property')
      })

      test('Non-ROOT links must have predecessors', () => {
        const graph = setupGraph()
        const nonRootLink = getHead(graph)[0]
        nonRootLink.body.prev = []
        expect(validate(graph)).not.toBeValid('Non-ROOT links must have predecessors')
      })

      test('The link referenced by the graph `root` property must be a ROOT link', () => {
        const graph = setupGraph()
        const rootLink = getRoot(graph)
        rootLink.body.type = 'FOO'
        rootLink.body.prev = graph.head
        expect(validate(graph)).not.toBeValid('The link referenced by the graph `root` property must be a ROOT link')
      })

      test(`Eve tampers with the root`, () => {
        const graph = setupGraph()

        // 🦹‍♀️ Eve tampers with the root
        const rootLink = getRoot(graph)
        rootLink.body.userId = eve.userId

        // 🦹‍♀️ She reencrypts the link with her private key
        graph.encryptedLinks[graph.root] = {
          encryptedBody: asymmetric.encrypt({
            secret: rootLink.body,
            recipientPublicKey: keys.encryption.publicKey,
            senderSecretKey: eve.keys.encryption.secretKey,
          }),
          recipientPublicKey: keys.encryption.publicKey,
          senderPublicKey: eve.keys.encryption.publicKey,
        }

        // 👩🏾 Alice is not fooled, because the root hash no longer matches the computed hash of the root link
        expect(validate(graph)).not.toBeValid('Root hash does not match')
      })

      test(`Eve tampers with the root and also changes the root hash`, () => {
        const graph = setupGraph()

        // 🦹‍♀️ Eve tampers with the root
        const rootLink = getRoot(graph)
        rootLink.body.user = eve

        const oldRootHash = graph.root

        // 🦹‍♀️ She reencrypts the link with her private key
        const encryptedBody = asymmetric.encrypt({
          secret: rootLink.body,
          recipientPublicKey: keys.encryption.publicKey,
          senderSecretKey: eve.keys.encryption.secretKey,
        })

        // 🦹‍♀️ She removes the old root
        delete graph.links[oldRootHash]
        delete graph.encryptedLinks[oldRootHash] // these links would resurface when syncing later anyway, because other people still have them

        // 🦹‍♀️ She generates a new root hash
        const newRootHash = hashEncryptedLink(encryptedBody)
        graph.root = newRootHash // this would also prevent syncing in the future, since two graphs with different roots can't sync

        // 🦹‍♀️  She adds the tampered root
        graph.encryptedLinks[newRootHash] = {
          encryptedBody,
          senderPublicKey: eve.keys.encryption.publicKey,
          recipientPublicKey: keys.encryption.publicKey,
        }
        graph.links[newRootHash] = rootLink

        // 👩🏾 Alice is not fooled, because the next link after the root now has the wrong hash
        expect(validate(graph)).not.toBeValid(
          'link referenced by one of the hashes in the `prev` property does not exist.'
        )
      })

      test(`Eve tampers with the head`, () => {
        const graph = setupGraph()

        // 🦹‍♀️ Eve tampers with the head
        const headHash = graph.head[0]
        const headLink = getLink(graph, headHash)
        headLink.body.userId = eve.userId

        // 🦹‍♀️ She reencrypts the link with her private key
        graph.encryptedLinks[headHash] = {
          encryptedBody: asymmetric.encrypt({
            secret: headLink.body,
            recipientPublicKey: keys.encryption.publicKey,
            senderSecretKey: eve.keys.encryption.secretKey,
          }),
          recipientPublicKey: keys.encryption.publicKey,
          senderPublicKey: eve.keys.encryption.publicKey,
        }

        // 👩🏾 Alice is not fooled, because the head hash no longer matches the computed hash of the head link
        expect(validate(graph)).not.toBeValid('Head hash does not match')
      })

      test(`Eve tampers with an arbitrary link`, () => {
        const graph = setupGraph()

        // 🦹‍♀️ Eve tampers with a link
        const linkHash = Object.keys(graph.links)[2] as Hash
        const link = getLink(graph, linkHash)

        link.body.payload = 'foo'

        // 🦹‍♀️ She reencrypts the link with her private key
        graph.encryptedLinks[linkHash] = {
          encryptedBody: asymmetric.encrypt({
            secret: link.body,
            recipientPublicKey: keys.encryption.publicKey,
            senderSecretKey: eve.keys.encryption.secretKey,
          }),
          recipientPublicKey: keys.encryption.publicKey,
          senderPublicKey: eve.keys.encryption.publicKey,
        }

        // 👩🏾 Alice is not fooled, because the link's hash no longer matches the computed hash of the head link
        expect(validate(graph)).not.toBeValid('hash calculated for this link does not match')
      })

      test(`timestamp out of order`, () => {
        const IN_THE_PAST = new Date('2020-01-01').getTime()
        const graph = setupGraph()

        // 🦹‍♀️ Eve sets her system clock back when appending a link
        const now = Date.now()
        setSystemTime(IN_THE_PAST)
        const graph2 = append({ graph, action: { type: 'FOO', payload: 'pizza' }, user: eve, keys })
        setSystemTime(now)

        expect(validate(graph2)).not.toBeValid(`timestamp can't be earlier than a previous link`)
      })

      test(`timestamp in the future`, () => {
        const IN_THE_FUTURE = new Date(`10000-01-01`).getTime() // NOTE: test will begin to fail 7,978 years from now
        const graph = setupGraph()

        // 🦹‍♀️ Eve sets her system clock forward when appending a link
        const now = Date.now()
        setSystemTime(IN_THE_FUTURE)
        const graph2 = append({ graph, action: { type: 'FOO', payload: 'pizza' }, user: eve, keys })
        setSystemTime(now)

        expect(validate(graph2)).not.toBeValid(`timestamp is in the future`)
      })
    })
  })
})
