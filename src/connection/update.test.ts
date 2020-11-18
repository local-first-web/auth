import { base64, hash } from '@herbcaudill/crypto'
import { BloomFilter } from 'bloomfilter'
import * as R from 'ramda'

import { getFilter } from './update'
import { ADMIN } from '/role'
import { Team } from '/team'
import { redactUser } from '/user'
import { alicesContext, bob, bobsContext, storage } from '/util/testing'

/**
 * Returns an optimally configured Bloom filter for the given number of elements, using the
 * calculations from https://www.di-mgt.com.au/bloom-filter.html .
 * @param n The number of elements to be added to the Bloom filter
 * @param p The target false positive rate
 */
const optimalBloomFilter = (n: number, p: number = 0.01) => {
  const LOG2 = Math.log(2)
  const m = Math.ceil((n * Math.log(p)) / Math.log(1 / 2 ** LOG2))
  const m2 = nextPowerOf2(m)
  const k = Math.ceil((LOG2 * m) / n)
  console.log({ n, m, m_round: m2, k, p })
  return new BloomFilter(m2, k)
}

const nextPowerOf2 = (m: number) => 2 ** Math.ceil(Math.log2(m - 1))

describe('connection', () => {
  beforeEach(() => {
    localStorage.clear()
    storage.contents = undefined
  })

  describe('update', () => {
    describe('Bloom filter', () => {
      it.only('testing', () => {
        let falsePositives = 0
        let falseNegatives = 0
        const n = 1000
        const p = 0.01

        const goodValues = randomArray(n)
        const badValues = randomArray(n)

        const filter = optimalBloomFilter(n, p)
        for (const hash of goodValues) filter.add(hash)

        for (const hash of goodValues) if (filter.test(hash) === false) falseNegatives++
        for (const hash of badValues) if (filter.test(hash) === true) falsePositives++

        const falsePositiveRate = falsePositives / n
        console.log({ falseNegatives, falsePositives, falsePositiveRate })
        expect(falseNegatives).toBe(0)
        expect(falsePositiveRate).toBeLessThanOrEqual(p)
      })

      it('should work', () => {
        // 👩🏾 Alice makes a team and does some admin stuff
        const aliceTeam = new Team({ teamName: 'Spies Я Us', context: alicesContext })
        aliceTeam.add(redactUser(bob))
        aliceTeam.addMemberRole('bob', ADMIN)
        aliceTeam.addRole({ roleName: 'MANAGERS' })
        aliceTeam.addMemberRole('bob', 'MANAGERS')

        storage.save(aliceTeam)

        // 👨‍🦲 at this point Bob is synced up with Alice
        const bobTeam = storage.load(bobsContext)

        // 👩🏾 Alice does some more stuff
        aliceTeam.addRole({ roleName: 'VIEWERS' })
        aliceTeam.invite('charlie', ['VIEWERS'])

        // 👨‍🦲 Bob does some stuff too
        bobTeam.addRole({ roleName: 'HR' })
        bobTeam.addMemberRole('alice', 'HR')
        bobTeam.addMemberRole('bob', 'HR')

        // Now they've diverged

        const aliceFilter = getFilter(aliceTeam.chain)
        const bobHashes = Object.keys(bobTeam.chain.links)
        const filterMatches = bobHashes.map(hash => aliceFilter.test(hash))
        expect(filterMatches).toEqual([true, true, true, true, true, false, false, false])
      })
    })
  })
})

const randomArray = (n: number) =>
  R.range(0, n).map(i => base64.encode(hash('foo', Math.random().toString())))
